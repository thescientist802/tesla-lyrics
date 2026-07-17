let lyrics = [];
let currentTime = 0;
let isPlaying = false;
let timerId;

const form = document.getElementById("search-form");
const artistInput = document.getElementById("artist-input");
const trackInput = document.getElementById("track-input");
const submitButton = document.getElementById("submit-button");
const controls = document.getElementById("controls");
const playPauseButton = document.getElementById("play-pause-btn");
const elapsedTime = document.getElementById("elapsed-time");
const lyricsContainer = document.getElementById("lyrics-container");
const status = document.getElementById("status");

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
    submitButton.disabled = true;
    status.textContent = "Fetching lyrics…";
    lyricsContainer.replaceChildren();
    controls.classList.add("hidden");
    isPlaying = false;
    currentTime = 0;
    updatePlayback();

    try {
        const query = new URLSearchParams({ artist, track });
        const response = await fetch(`/lyrics?${query}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Couldn't fetch lyrics.");
        }

        lyrics = data.lyrics;
        if (!lyrics.length) {
            throw new Error("No timed lyrics were found for this track.");
        }

        renderLyrics();
        controls.classList.remove("hidden");
        status.textContent = `Showing ${data.trackName} — ${data.artistName}`;
    } catch (error) {
        lyrics = [];
        status.textContent = error.message;
        console.error("Lyric request failed:", error);
    } finally {
        submitButton.disabled = false;
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
