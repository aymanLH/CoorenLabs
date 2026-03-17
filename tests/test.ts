// async function fetchVideo() {
//     const url = "https://streamta.site/get_video?id=vx8e4b2ZLRS4mZb&expires=1773190204&ip=F0EUKRERKxSHDN&token=-FiHsvx8N_37&stream=1";


//     const options: RequestInit = {
//         method: "GET",
//         redirect: "manual",
//         headers: {
//             "Accept": "*/*",
//             "Accept-Encoding": "identity;q=1, *;q=0",
//             "Accept-Language": "en-US,en;q=0.5",
//             "Connection": "keep-alive",
//             "Cookie": "_ym_uid=1773119056405401869; _ym_d=1773119056; _ym_isad=2",
//             "origin": "https://streamta.site",
//             "Referer": "https://streamta.site/e/vx8e4b2ZLRS4mZb/Fight.Club.10th.Anniversary.Edition.1999.1080p.BrRip.x264.YIFY.mp4",
//             "sec-ch-ua": '"Not:A-Brand";v="99", "Brave";v="145", "Chromium";v="145"',
//             "sec-ch-ua-mobile": "?0",
//             "sec-ch-ua-platform": '"Windows"',
//             "Sec-Fetch-Dest": "video",
//             "Sec-Fetch-Mode": "cors",
//             "Sec-Fetch-Site": "same-origin",
//             "Sec-Fetch-Storage-Access": "none",
//             "Sec-GPC": "1",
//             "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
//         }
//     };

//     try {
//         console.log(`Sending GET request to ${new URL(url).hostname}...`);
//         const response = await fetch(url, options);

//         // Logging the core response details
//         console.log("\n=== Response Status ===");
//         console.log(`Status Code: ${response.status}`);
//         console.log(`Status Text: ${response.statusText}`);
//         console.log(`Response OK: ${response.ok}`);
//         console.log(`Redirected: ${response.redirected}`);
//         console.log(`res: ${await response.text()}`);

//         // Iterating and logging all response headers
//         console.log("\n=== Response Headers ===");
//         for (const [key, value] of response.headers.entries()) {
//             console.log(`${key}: ${value}`);
//         }

//         if (response.ok) {
//             console.log("\nRequest successful! (Since this looks like a video stream, you'd handle the response body as an ArrayBuffer, Blob, or ReadableStream next).");
//         }

//     } catch (error) {
//         console.error("\nFetch failed:", error);
//     }
// }

// // Execute the function
// fetchVideo();

// extractStreamtape("https://streamta.site/e/0ZqD3GkxGxUbPpV/")
// extractStreamtape("https://streamta.site/e/XqG4KlpxPjHD8WO/War.Machine.2026.1080p.NF.WEB-DL.DDP5.1.Atmos.H.264-BYNDR.mp4")
// extractStreamtape("https://streamta.site/e/XJPA3KYAy7uDVJk/")
// extractStreamtape("https://streamta.site/e/gq3zd7ZBpaIqyg9/Rooster.S01E01.Release.the.Brown.Fat.1080p.AMZN.WEB-DL.DDP5.1.Atmos.H.264-RAWR.mp4")
// extractStreamtape("https://streamta.site/e/8J28dLJKKqiozQX/Cold.Storage.2026.1080p.AMZN.WEB-DL.DDP5.1.H.264-KyoGo.mp4")



// fetch("https://df1118oi.cloudatacdn.com/u5kjultnmldlsdgge5mukj2hd4rwphlig6ccleqvor73efu4inm35fgxrq3q/q8xgykyxnc~", {
//   "headers": {
//     "accept": "*/*",
//     "accept-language": "en-US,en;q=0.9,hi;q=0.8,bn;q=0.7",
//     "priority": "u=1, i",
//     "sec-ch-ua": "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
//     "sec-ch-ua-mobile": "?0",
//     "sec-ch-ua-platform": "\"Windows\"",
//     "sec-fetch-dest": "empty",
//     "sec-fetch-mode": "cors",
//     "sec-fetch-site": "same-origin",
//     // "cookie": "cf_clearance=oyed4X9iXmtDQ.kzjFtfZd07rD8NyN4fSQlsmOdkSe4-1773210248-1.2.1.1-_hkIXrlHCmHUW.aoRYnTphA63Xf9pJPflrKRkkIoczBao7yZQgdnfpzQZXVQfVKjyA3TfP_jf0K5X4o5K8s43vwlre5uVcRpdEHQHZDtHFAa8gH95gzCqvUIElXPvT65bRh4plDFlR2oxh9H8Uq1oI.K0jyoXLyqpK4f8SH05s7bM_fgQpIlBbYGZdDdNif9.adD8KbDpflut1dPlRvfb8GtU_F1udkuFkBEph4wY8U",
//     "Referer": "https://myvidplay.com/e/eim6essqq2hk"
//   },
//   "body": null,
//   "method": "GET"
// }).then(async res => console.log(res.status, res.headers))

// import { extractDoodstream } from "../src/providers/primesrc/extractors/doodstream.ts"
// extractDoodstream("https://dood.watch/e/e9glv75abtqn")

fetch("https://lancewhosedifficult.com/e/t3isw0ddjm9v", {
  "headers": {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "priority": "u=0, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "iframe",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "cross-site",
    "sec-fetch-storage-access": "active",
    "upgrade-insecure-requests": "1",
    "cookie": "XSRF-TOKEN=eyJpdiI6ImxweU5Fbk5MTnBnYW44YmRKUDdiblE9PSIsInZhbHVlIjoieFN5bFVLUVpYVU1EM0ErYU5rdW5JUUZYNzhJVVBFb1VSeHlBeWJQSksxY1Nyb0lPdnBiOHYzTkIzYURwUlVwcUFwRndWVzJPTzZDYnJZS2h5VENDSVVIUnRxbm5xVWc3eGdkdkY5M2JaN1M2K1ZDMmlrMmhPcXVqaUkwN2UveSsiLCJtYWMiOiI4MThiZjhlMWQ5OTFlOWE2YzcyNzVhM2Q1MzlhZjNhNjA4N2VlODU5ODY3OGYzNTkyMjFhYjY1NDgyMDcwYTVlIiwidGFnIjoiIn0%3D; voe_session=eyJpdiI6IkRlcU85Z2c1ZFJnZUFEV3daanRvU1E9PSIsInZhbHVlIjoiNE9YMVY2Y1orR2lpZEFnczNNT2JWV0YxTGlsUld0K2t3eFlEOXJTcEc0cWlBZVVNLzd5UXJZQXdmbE4rb0JaY2xHT0J4dnFMYVFaa2FKYzM0dVNjN0VXdW92eDZpN1hweGl2TU5LM241d012L2p0ZTlUL2dCZzN3VSthaDBCeWkiLCJtYWMiOiI3M2FjMTNmOGVkMWFiYzg1ZTMyNzc2MDY3N2ViY2ZiYTIzYjZlOWZkNTExMTRkMGYyM2U4NTdhODZmOTUyMzkzIiwidGFnIjoiIn0%3D",
    "Referer": "https://primesrc.me/"
  },
  "body": null,
  "method": "GET"
}).then(async res => {
  console.log(res.status)
  console.log(res.headers)
  console.log(res.redirected)
  console.log(await res.text())
})