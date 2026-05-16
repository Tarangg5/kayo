export default {
  async fetch(request, env, ctx) {
    const jsonUrl = "https://sayan-json-3.pages.dev/loura.json";

    try {
      // 1. JSON data fetch karein
      const jsonResponse = await fetch(jsonUrl, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (!jsonResponse.ok) {
        return new Response("Failed to fetch JSON data", { status: 500 });
      }

      const data = await jsonResponse.json();
      const iframes = data.iframes || [];

      // Jin channels ko target karna hai unki list
      const targetNames = ["Kayo Hindi ", "Sky Sports 4K "]; 
      // Note: Aapke JSON me name ke end me space hai ("Kayo Hindi " aur "Sky Sports 4K "), isliye exact match rakha hai.

      let m3uPlaylist = "#EXTM3U\n";

      // 2. Target channels ko filter aur process karein
      for (const item of iframes) {
        if (targetNames.includes(item.name)) {
          const channelName = item.name.trim();
          const iframeSrc = item.iframeSrc;

          if (!iframeSrc) continue;

          try {
            // Channel ka HTML page fetch karein
            const htmlResponse = await fetch(iframeSrc, {
              headers: { "User-Agent": "Mozilla/5.0" }
            });
            
            if (!htmlResponse.ok) continue;
            const htmlText = await htmlResponse.text();

            // Regex se STREAM_URL nikalna
            const streamUrlMatch = htmlText.match(/const\s+STREAM_URL\s*=\s*["']([^"']+)["']/);
            // Regex se CLEAR_KEYS nikalna
            const clearKeysMatch = htmlText.match(/const\s+CLEAR_KEYS\s*=\s*\{([^}]+)\}/);

            if (streamUrlMatch && clearKeysMatch) {
              const streamUrl = streamUrlMatch[1];
              const keysContent = clearKeysMatch[1];

              // Key aur Value ko extract karna (e.g. "b62efe3c810e550dadeb87bf43ba0987": "8ec64c8434c98d627b639fad5313dc18")
              const kvMatch = keysContent.match(/["']([a-fA-F0-9]{32})["']\s*:\s*["']([a-fA-F0-9]{32})["']/);

              if (kvMatch) {
                const keyId = kvMatch[1];
                const keyVal = kvMatch[2];
                const finalClearKey = `${keyId}:${keyVal}`;

                // OTT Navigator standard M3U format build karna
                m3uPlaylist += `#EXTINF:-1 tvg-id="${channelName}" tvg-name="${channelName}" tvg-logo="${item.logourl || ''}" group-title="⚡ LIVE TV",${channelName}\n`;
                m3uPlaylist += `#KODIPROP:inputstream.adaptive.license_type=clearkey\n`;
                m3uPlaylist += `#KODIPROP:inputstream.adaptive.license_key=${finalClearKey}\n`;
                m3uPlaylist += `${streamUrl}\n`;
              }
            }
          } catch (err) {
            // Agar kisi ek channel me error aaye toh skip karein, baaki chle
            continue;
          }
        }
      }

      // 3. Plain Text (M3U) response return karein
      return new Response(m3uPlaylist, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300" // 5 mins cache takki load fast ho
        }
      });

    } catch (error) {
      return new Response("Error: " + error.message, { status: 500 });
    }
  }
};
