let lyrics = [];
let currentTime = 3.0;
let isPlaying = false;
let timerId;
let spotifyPollTimer;
let lyricRequestId = 0;

const form = document.getElementById("search-form");
const artistInput = document.getElementById("artist-input");
const trackInput = document.getElementById("track-input");
const submitButton = document.getElementById("submit-button");
const controls = document.getElementById("controls");
const playPauseButton = document.getElementById("play-pause-btn");
const elapsedTime = document.getElementById("elapsed-time");
const lyricsContainer = document.getElementById("lyrics-container");
const status = document.getElementById("status");
const spotifyLoginButton = document.getElementById("spotify-login-button");
const accountPanel = document.getElementById("account-panel");
const profileImage = document.getElementById("profile-image");
const profileName = document.getElementById("profile-name");
const nowPlaying = document.getElementById("now-playing");
const albumImage = document.getElementById("album-image");
const nowPlayingTrack = document.getElementById("now-playing-track");
const nowPlayingArtist = document.getElementById("now-playing-artist");
const spotifyProgress = document.getElementById("spotify-progress");
const spotifyStatus = document.getElementById("spotify-status");
let displayedTrackId = null;

form.addEventListener("submit", async (event) => {
    event.preventDefault(); // A form submit otherwise reloads the page and cancels the request.

    const artist = artistInput.value.trim();
    const track = trackInput.value.trim();
    
    if (!artist || !track) return;

    await loadLyrics(artist, track);
});

playPauseButton.addEventListener("click", () => {
    isPlaying = !isPlaying;
    playPauseButton.textContent = isPlaying ? "Pause" : "Play";
});

async function loadLyrics(artist, track) {
    const requestId = ++lyricRequestId;
    submitButton.disabled = true;
    status.textContent = "Fetching lyrics…";
    lyricsContainer.replaceChildren();
    controls.classList.add("hidden");
    isPlaying = false;
    currentTime = 3.0;
    updatePlayback();

    try {
        const query = new URLSearchParams({ artist, track });
        const response = await fetch(`/lyrics?${query}`);
        const data = await response.json();

        // A newer track may have been detected while this request was in flight.
        if (requestId !== lyricRequestId) return;

        if (!response.ok) {
            throw new Error(data.error || "Couldn't fetch lyrics.");
        }

        lyrics = data.lyrics;
        if (!lyrics.length) {
            throw new Error("No timed lyrics were found for this track.");
        }

        renderLyrics();
        controls.classList.remove("hidden");
        isPlaying = true;
        playPauseButton.textContent = "Pause";
        status.textContent = "";
    } catch (error) {
        if (requestId !== lyricRequestId) return;
        lyrics = [];
        status.textContent = error.message;
        console.error("Lyric request failed:", error);
    } finally {
        if (requestId === lyricRequestId) {
            submitButton.disabled = false;
        }
    }
}

function renderLyrics() {
    const lines = lyrics.map((lyric, index) => {
        const line = document.createElement("p");
        line.className = "lyric-line";
        line.dataset.index = index;
        line.textContent = lyric.text || "♪";
        return line;
    });
    lyricsContainer.replaceChildren(...lines);
}

function updatePlayback() {
    elapsedTime.textContent = formatTime(currentTime);
    const activeIndex = lyrics.reduce(
        (lastIndex, lyric, index) => lyric.time <= currentTime ? index : lastIndex,
        -1
    );

    lyricsContainer.querySelectorAll(".lyric-line").forEach((line, index) => {
        const active = index === activeIndex;
        line.classList.toggle("active", active);
        if (active) line.scrollIntoView({ block: "center", behavior: "smooth" });
    });
}

function formatTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
}

timerId = window.setInterval(() => {
    if (!isPlaying || !lyrics.length) return;

    currentTime += 0.1;
    updatePlayback();

    if (currentTime > lyrics.at(-1).time + 4) {
        isPlaying = false;
        playPauseButton.textContent = "Play";
    }
}, 100);

async function loadSpotifySession() {
    try {
        const response = await fetch("/api/session");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "You are not signed in to Spotify.");
        }

        profileName.textContent = `Signed in as ${data.profile.displayName}`;
        setImage(profileImage, data.profile.imageUrl, "Spotify profile");
        accountPanel.classList.remove("hidden");
        spotifyLoginButton.classList.add("hidden");
        spotifyStatus.textContent = "";
        await loadCurrentlyPlaying();
        // Two seconds is responsive to track switches without making excessive API requests.
        spotifyPollTimer = window.setInterval(loadCurrentlyPlaying, 2_000);
    } catch (error) {
        spotifyLoginButton.classList.remove("hidden");
        spotifyStatus.textContent = "Sign in to Spotify to show your currently playing track.";
        console.info("Spotify session unavailable:", error.message);
    }
}

async function loadCurrentlyPlaying() {
    try {
        const response = await fetch("/api/currently-playing");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Couldn't read Spotify playback.");
        }

        if (!data.track) {
            nowPlaying.classList.add("hidden");
            spotifyStatus.textContent = data.message || "Nothing is playing on Spotify right now.";
            return;
        }

        nowPlayingTrack.textContent = data.track.name;
        nowPlayingTrack.href = data.track.spotifyUrl || "#";
        nowPlayingArtist.textContent = `${data.track.artist} · ${data.track.album}`;
        spotifyProgress.textContent = data.progressMs == null
            ? "Spotify playback position unavailable"
            : `${formatTime(data.progressMs / 1000)} / ${formatTime(data.track.durationMs / 1000)}`;
        setImage(albumImage, data.track.imageUrl, `Album art for ${data.track.name}`);
        nowPlaying.classList.remove("hidden");
        spotifyStatus.textContent = data.isPlaying ? "Playing now" : "Playback is paused";

        if (data.track.id !== displayedTrackId) {
            displayedTrackId = data.track.id;
            artistInput.value = data.track.artist;
            trackInput.value = data.track.name;
            loadLyrics(data.track.artist, data.track.name);
        }
    } catch (error) {
        spotifyStatus.textContent = error.message;
        console.error("Playback request failed:", error);
    }
}

function setImage(image, url, alt) {
    if (!url) {
        image.removeAttribute("src");
        image.classList.add("hidden");
        return;
    }

    image.src = url;
    image.alt = alt;
    image.classList.remove("hidden");
}

loadSpotifySession();

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadCurrentlyPlaying();
});
