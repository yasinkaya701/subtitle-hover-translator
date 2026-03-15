document
    .getElementById("open-settings-button")
    .addEventListener("click", function() {
        webkit.messageHandlers.controller.postMessage("open-settings");
    });
