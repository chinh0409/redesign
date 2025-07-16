const imgbbApiKey = "f829f5c3ec6f16ac3f0f5a31a85cfd57";

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "LOAD_SCREENSHOT") return;
  if (document.getElementById("cropperOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "cropperOverlay";
  Object.assign(overlay.style, {
    position: "fixed",
    top: 0, left: 0,
    width: "100vw", height: "100vh",
    background: "rgba(0,0,0,0.5)",
    zIndex: "999999",
    cursor: "crosshair"
  });
  document.body.appendChild(overlay);

  const img = new Image();
  img.src = message.dataUrl;
  Object.assign(img.style, {
    position: "absolute",
    top: 0, left: 0,
    width: "100%", height: "100%",
    pointerEvents: "none"
  });
  overlay.appendChild(img);

  let startX, startY, box;

  overlay.addEventListener("mousedown", (e) => {
    startX = e.pageX;
    startY = e.pageY;
    box = document.createElement("div");
    Object.assign(box.style, {
      position: "absolute",
      border: "2px dashed yellow",
      background: "rgba(255,255,255,0.2)",
      zIndex: "1000000"
    });
    overlay.appendChild(box);
  });

  overlay.addEventListener("mousemove", (e) => {
    if (!box) return;
    const width = Math.abs(e.pageX - startX);
    const height = Math.abs(e.pageY - startY);
    const left = Math.min(e.pageX, startX);
    const top = Math.min(e.pageY, startY);
    Object.assign(box.style, {
      width: `${width}px`, height: `${height}px`,
      left: `${left}px`, top: `${top}px`
    });
  });

  overlay.addEventListener("mouseup", () => {
    const rect = box.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");

    const tempImg = new Image();
    tempImg.src = message.dataUrl;
    tempImg.onload = () => {
      ctx.drawImage(
        tempImg,
        rect.left, rect.top, rect.width, rect.height,
        0, 0, rect.width, rect.height
      );

      const base64 = canvas.toDataURL("image/png").split(",")[1];

      fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
        method: "POST",
        body: new URLSearchParams({ image: base64 })
      })
      .then(res => res.json())
      .then(data => {
        const url = data.data.url;
        chrome.storage.local.set({ croppedImageUrl: url });

        // ✅ Tiếp tục gọi các API sau khi đã có croppedImageUrl
        chrome.storage.local.get("baseUrl", ({ baseUrl }) => {
          if (!baseUrl) return;

          // Gọi API 1 - process-image
          fetch(`${baseUrl}/api/process-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ main_url: url })
          })
          .then(res => res.json())
          .then(data1 => {
            const processed = data1.processed_images || {};
            chrome.storage.local.set({ processedImages: processed });

            // Gọi API 2 - recognize-character
            fetch(`${baseUrl}/api/recognize-character`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ main_url: url })
            })
            .then(res => res.json())
            .then(data2 => {
              chrome.storage.local.set({ characterInfo: data2.character_info });
            });
          });
        });
      })
      .catch(err => {
        console.error("Lỗi khi upload ảnh:", err);
        alert("Lỗi upload ảnh lên imgbb.");
      })
      .finally(() => {
        document.body.removeChild(overlay);
      });
    };
  });
});
