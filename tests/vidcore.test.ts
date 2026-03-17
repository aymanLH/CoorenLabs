import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { vidcore } from '../src/providers/stream/vidcore/vidcore'; // <-- Updated path
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { PORT } from '../src/core/config'; // <-- Updated path

async function runTest() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log("=========================================");
    console.log("      🎬 Vidcore Stream Test CLI 🎬      ");
    console.log("=========================================\n");
    console.log("⚠️  Make sure your main API server is running (bun run src/index.ts) so the proxy works!\n");

    let choice = await rl.question('Do you want to test a Movie or TV Series? (m/tv): ');
    choice = choice.trim().toLowerCase();

    let result: any;

    if (choice === 'm' || choice === 'movie') {
      const tmdbId = await rl.question('Enter TMDB ID (e.g., 550 for Fight Club): ');
      console.log(`\n[Test] Fetching Movie -> TMDB: ${tmdbId}...\n`);
      result = await vidcore.fetchMovie(tmdbId);
    } else if (choice === 'tv' || choice === 't') {
      const tmdbId = await rl.question('Enter TMDB ID (e.g., 1399 for Game of Thrones): ');
      const season = await rl.question('Enter Season Number (e.g., 1): ');
      const episode = await rl.question('Enter Episode Number (e.g., 1): ');
      console.log(`\n[Test] Fetching TV -> TMDB: ${tmdbId} | S${season} E${episode}...\n`);
      result = await vidcore.fetchTv(tmdbId, season, episode);
    } else {
      console.log('\n❌ Invalid input. Exiting.');
      process.exit(1);
    }

    console.log('\n=========================================');
    console.log('               TEST RESULT               ');
    console.log('=========================================');
    console.log(JSON.stringify(result, null, 2));

    // --- AUTO PLAYER LAUNCHER ---
    if (result && result.sources && result.sources.length > 0) {
      // Assuming your proxy is returning a relative URL like /proxy/m3u8-proxy...
      const rawUrl = result.sources[0].url;
      const fullStreamUrl = `http://localhost:${PORT || 3000}${rawUrl}`;
      
      console.log(`\n▶️  Launching Video Player for: ${fullStreamUrl}`);

      // Create a temporary HTML file with an HLS.js player
      const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Vidcore Test Player</title>
          <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
          <style>
              body { background: #0f0f0f; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; flex-direction: column; color: white; font-family: sans-serif; }
              video { width: 80%; max-width: 1000px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); background: #000; }
              h2 { margin-bottom: 20px; font-weight: 300; }
          </style>
      </head>
      <body>
          <h2>Vidcore Stream Proxy Test</h2>
          <video id="video" controls autoplay></video>
          <script>
              const video = document.getElementById('video');
              const url = "${fullStreamUrl}";
              
              if (Hls.isSupported()) {
                  const hls = new Hls();
                  hls.loadSource(url);
                  hls.attachMedia(video);
                  hls.on(Hls.Events.MANIFEST_PARSED, function() {
                      video.play();
                  });
              } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                  video.src = url;
                  video.play();
              }
          </script>
      </body>
      </html>
      `;

      // Save the HTML file to the tests folder
      const htmlPath = path.resolve(__dirname, 'test-player.html');
      fs.writeFileSync(htmlPath, htmlContent);

      // Open the HTML file in the user's default browser based on OS
      const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${startCmd} file://${htmlPath}`);
      
      console.log("\n✅ Video player opened in your web browser!");
    } else {
      console.log("\n❌ No playable sources found to launch.");
    }

  } catch (error) {
    console.error('\n❌ Test script encountered a critical error:', error);
  } finally {
    rl.close();
    // Give the browser 2 seconds to open before killing the background Chrome instance
    setTimeout(() => {
      console.log("\n[Test] Shutting down background processes...");
      process.exit(0);
    }, 2000);
  }
}

runTest();