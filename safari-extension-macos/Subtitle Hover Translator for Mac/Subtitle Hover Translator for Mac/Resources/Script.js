function show(enabled, useSettingsInsteadOfPreferences) {
    if (useSettingsInsteadOfPreferences) {
        document.getElementsByClassName('state-on')[0].innerText = "Uzanti etkin. Safari Settings icinde isterseniz tekrar kapatabilirsiniz.";
        document.getElementsByClassName('state-off')[0].innerText = "Uzanti kapali. Safari Settings icindeki Extensions bolumunden acin.";
        document.getElementsByClassName('state-unknown')[0].innerText = "Uzanti durumu okunuyor. Gerekirse Safari Settings icindeki Extensions bolumunden etkinlestirin.";
        document.getElementsByClassName('open-preferences')[0].innerText = "Safari ayarlarini ac";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
