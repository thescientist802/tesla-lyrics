const express = require("express")
const axios = require("axios")
require("dotenv").config()

const app = express()

app.use(express.static("public"));

const PORT = process.env.PORT || 3000

app.get("/auth/login", (req, res) => {

    const scopes = [
        "user-read-private",
        "user-read-playback-state",
        "user-read-currently-playing"
    ].join(" ")
    
    const spotifyAuthURL = new URLSearchParams({
            client_id: process.env.SPOTIFY_CLIENT_ID,
            response_type: "code",
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            scope: scopes,
            // During development, always show the consent screen so scope changes are obvious.
            show_dialog: "true",
        })

    res.redirect(`https://accounts.spotify.com/authorize?${spotifyAuthURL.toString()}`)
});

app.get("/auth/callback", async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;

    if(error) {
        return res.status(400).send(`Spotify returned an error: ${error}`);
    }

    if(!code) {
        return res.status(400).send(`No authorization code recieved`);
    }

    try {
        const tokenResponse = await axios.post(
            "https://accounts.spotify.com/api/token",
            new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization":
                        "Basic " +
                        Buffer.from(
                            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                        ).toString("base64"),
                },
            }
        );

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        app.locals.spotifyTokens = {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + expires_in * 1000, //this in memory storage is a placeholder, disappears if server restarts and only supports one user at a time
        }

        res.redirect("/")
    } catch (err) {
        console.error("Token exchange failed:", err.response?.data || err.message);
        res.status(500).send("Something went wrong when exchanging code for a token.")
    }
})

async function getSpotifyAccessToken() {
    const tokens = app.locals.spotifyTokens;

    if (!tokens) {
        const error = new Error("Not signed in to Spotify.");
        error.status = 401;
        throw error;
    }

    // Refresh one minute early so an API request is not made with an expired token.
    if (Date.now() < tokens.expiresAt - 60_000) {
        return tokens.accessToken;
    }

    const tokenResponse = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: tokens.refreshToken,
        }),
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + Buffer.from(
                    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                ).toString("base64"),
            },
        }
    );

    tokens.accessToken = tokenResponse.data.access_token;
    tokens.expiresAt = Date.now() + tokenResponse.data.expires_in * 1000;
    if (tokenResponse.data.refresh_token) {
        tokens.refreshToken = tokenResponse.data.refresh_token;
    }

    return tokens.accessToken;
}

function sendSpotifyError(res, err) {
    const status = err.response?.status || err.status || 500;
    const message = err.response?.data?.error?.message || err.message || "Spotify request failed.";

    if (status === 401) {
        delete app.locals.spotifyTokens;
    }

    console.error("Spotify API request failed:", err.response?.data || err.message);
    return res.status(status).json({ error: message });
}

app.get("/api/session", async (req, res) => {
    try {
        const accessToken = await getSpotifyAccessToken();
        const profileResponse = await axios.get("https://api.spotify.com/v1/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const profile = profileResponse.data;

        res.json({
            signedIn: true,
            profile: {
                id: profile.id,
                displayName: profile.display_name || profile.id,
                imageUrl: profile.images?.[0]?.url || null,
                spotifyUrl: profile.external_urls?.spotify || null,
            },
        });
    } catch (err) {
        sendSpotifyError(res, err);
    }
});

app.get("/api/currently-playing", async (req, res) => {
    try {
        const accessToken = await getSpotifyAccessToken();
        const playbackResponse = await axios.get("https://api.spotify.com/v1/me/player", {
            headers: { Authorization: `Bearer ${accessToken}` },
            validateStatus: (status) => status === 200 || status === 204,
        });

        if (playbackResponse.status === 204) {
            return res.json({
                isPlaying: false,
                track: null,
                message: "Spotify did not report an active playback device.",
            });
        }

        const playback = playbackResponse.data;
        const item = playback.item;

        if (!item || item.type !== "track") {
            return res.json({
                isPlaying: false,
                track: null,
                message: "Spotify is not currently playing a music track.",
            });
        }

        res.json({
            isPlaying: playback.is_playing,
            progressMs: playback.progress_ms,
            track: {
                id: item.id,
                name: item.name,
                artist: item.artists.map((artist) => artist.name).join(", "),
                album: item.album.name,
                durationMs: item.duration_ms,
                imageUrl: item.album.images?.[0]?.url || null,
                spotifyUrl: item.external_urls?.spotify || null,
            },
        });
    } catch (err) {
        sendSpotifyError(res, err);
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://127.0.0.1:${PORT}`);
})

function parseSyncedLyrics(syncedLyrics) {
    const lines = syncedLyrics.split("\n")
    const timeTagPattern = /\[(\d{2}):(\d{2})\.(\d{2})\]/;

    const parsedLines = [];

    for (const line of lines) {
        const match = line.match(timeTagPattern);
        if(!match) continue;

        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const hundreths = parseInt(match[3], 10);

        const totalSeconds = minutes * 60 + seconds + hundreths/100
        const text = line.replace(timeTagPattern, "").trim();

        parsedLines.push({ time: totalSeconds, text });
    }
    return parsedLines;
}

app.get("/lyrics", async (req, res ) => {
    const { artist, track, album, duration } = req.query;

    if(!artist || !track) {
        return res.status(400).json({ error: "artist and track query params rqeuired"});
    }

    try {
        const lrclibResponse = await axios.get("https://lrclib.net/api/get", {
            params: {
                artist_name: artist,
                track_name: track,
                album_name: album,
                duration: duration,
            },
        });

        const { syncedLyrics, plainLyrics, trackName, artistName } = lrclibResponse.data;

        if (!syncedLyrics) {
            return res.status(400).json({
                error: "No synced lyrics available for track",
                plainLyrics: plainLyrics || null
            })
        }

        const parsedLyrics = parseSyncedLyrics(syncedLyrics);

        res.json({ trackName, artistName, lyrics: parsedLyrics });
    } catch (err) {
        console.error("Lyric fetch failed:", err.response?.data || err.message);
        res.status(500).json({ error: "Failed to fetch lyrics"});
    }
})
