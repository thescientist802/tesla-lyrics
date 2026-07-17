const express = require("express")
const axios = require("axios")
require("dotenv").config()

const app = express()

app.use(express.static("public"));

const PORT = process.env.PORT || 3000

app.get("/auth/login", (req, res) => {

    const scopes = [
        "user-read-playback-state",
        "user-read-currently-playing"
    ].join(" ")
    
    const spotifyAuthURL = new URLSearchParams({
            client_id: process.env.SPOTIFY_CLIENT_ID,
            response_type: "code",
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            scope: scopes
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

        res.send("Login success!")
    } catch (err) {
        console.error("Token exchange failed:", err.response?.data || err.message);
        res.status(500).send("Something went wrong when exchanging code for a token.")
    }
})

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

        const minutes = parseInt(matchp[1], 10);
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