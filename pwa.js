(() => {
  const installLinks = [...document.querySelectorAll("[data-install-app]")];
  const status = document.getElementById("appInstallStatus");
  let installPrompt = null;
  const standalone = window.matchMedia("(display-mode: standalone)");
  const isInstalled = () => standalone.matches || navigator.standalone === true;
  const setStatus = message => { if (status) status.textContent = message; };
  const updateLinks = () => {
    installLinks.forEach(link => { link.hidden = isInstalled(); });
    if (isInstalled()) setStatus("You're using the installed app. League data still needs an internet connection.");
  };
  updateLinks();
  standalone.addEventListener("change", updateLinks);

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    setStatus("Installation is available. Select Install app to continue.");
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installLinks.forEach(link => { link.hidden = true; });
    setStatus("App installed. Open Fantasy FO from your home screen or app launcher.");
  });
  installLinks.forEach(link => link.addEventListener("click", async event => {
    if (!installPrompt) return;
    event.preventDefault();
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setStatus(choice.outcome === "accepted" ? "Installation accepted. Your browser will finish adding the app." : "Installation cancelled. You can use the browser menu or try again later.");
    } catch (error) {
      console.error("Fantasy Front Office installation failed:", error);
      setStatus("Installation could not start. Use the browser menu or the instructions on the Install page.");
    }
  }));

  const supportedHost = ["fantasyfo.com", "localhost", "127.0.0.1"].includes(location.hostname);
  if ("serviceWorker" in navigator && window.isSecureContext && supportedHost) {
    navigator.serviceWorker.register("/service-worker.js?v=20261031-app-install-2", { scope: "/", updateViaCache: "none" }).catch(error => {
      console.error("Fantasy Front Office app setup failed:", error);
      setStatus("App setup could not finish. You can still use the website; reopen it online to retry.");
    });
  }
})();
