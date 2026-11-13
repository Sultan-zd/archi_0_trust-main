<#--
  Thème de connexion AI-ZTB : même identité visuelle que la page d'accueil et la page d'inscription.
  Mise en page commune à toutes les pages Keycloak (connexion, erreurs, déconnexion, mise à jour du mot de passe…).
-->
<#import "footer.ftl" as loginFooter>
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<#-- Adresse de l'application : "Base URL" du client Keycloak, sinon la valeur par défaut du thème. -->
<#assign appUrl = ((client.baseUrl)?has_content)?then(client.baseUrl, properties.ztbAppUrl)?remove_ending("/")>
<!DOCTYPE html>
<html lang="<#if realm.internationalizationEnabled>${locale.currentLanguageTag}<#else>fr</#if>">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="#ffffff">
    <title>${msg("ztbPageTitle")}</title>
    <link rel="icon" type="image/svg+xml" href="${url.resourcesPath}/img/favicon.svg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..800&display=swap">
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet">
        </#list>
    </#if>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="module">
        import { startSessionPolling } from "${url.resourcesPath}/js/authChecker.js";
        startSessionPolling("${url.ssoLoginInOtherTabsUrl?no_esc}");
    </script>
</head>

<body class="ztb ${bodyClass}">
<div class="ztb-page">
    <main class="ztb-pane">
        <header class="ztb-top">
            <a class="ztb-brand" href="${appUrl}/" aria-label="AI-ZTB, retour à l'accueil">
                <img src="${url.resourcesPath}/img/favicon.svg" alt="" width="30" height="30">
                <span>AI-ZTB</span>
            </a>
            <a class="ztb-back" href="${appUrl}/">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
                ${msg("ztbBackHome")}
            </a>
        </header>

        <div class="ztb-inner">
            <#if auth?has_content && auth.showUsername() && !auth.showResetCredentials()>
                <#nested "show-username">
                <div class="ztb-user-chip" id="kc-username">
                    <span class="ztb-avatar">${(auth.attemptedUsername!'?')?substring(0, 1)?upper_case}</span>
                    <span id="kc-attempted-username">${auth.attemptedUsername}</span>
                    <a id="reset-login" href="${url.loginRestartFlowUrl}">${msg("ztbChangeUser")}</a>
                </div>
            </#if>

            <h1 id="kc-page-title"><#nested "header"></h1>
            <#nested "subtitle">

            <#-- Les actions initiées par l'application ne doivent pas afficher d'avertissement pendant la connexion. -->
            <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                <div class="ztb-alert ztb-alert-${message.type}" role="<#if message.type = 'error'>alert<#else>status</#if>">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <#if message.type = 'success'><path d="m5 12.5 4.5 4.5L19 7.5"/>
                        <#elseif message.type = 'error'><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>
                        <#else><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/></#if>
                    </svg>
                    <span>${kcSanitize(message.summary)?no_esc}</span>
                </div>
            </#if>

            <div id="kc-content"><#nested "form"></div>

            <#if auth?has_content && auth.showTryAnotherWayLink()>
                <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post">
                    <input type="hidden" name="tryAnotherWay" value="on"/>
                    <button type="submit" class="ztb-link">${msg("doTryAnotherWay")}</button>
                </form>
            </#if>

            <#nested "socialProviders">

            <#if displayInfo>
                <div id="kc-info" class="ztb-info"><#nested "info"></div>
            </#if>
        </div>

        <footer class="ztb-foot">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>
            ${msg("ztbSecuredBy")}
        </footer>
        <@loginFooter.content/>
    </main>

    <aside class="ztb-visual" aria-hidden="true">
        <div class="ztb-v-glow"></div>
        <div class="ztb-v-grid"></div>
        <div class="ztb-v-content">
            <span class="ztb-v-badge"><i></i> Zero Trust</span>
            <h2>${msg("ztbVisualTitle1")}<br><span>${msg("ztbVisualTitle2")}</span></h2>
            <ul class="ztb-v-steps">
                <li><span><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M15 10h3M15 13.5h3"/></svg></span>
                    <div><b>${msg("ztbStep1")}</b><small>${msg("ztbStep1Text")}</small></div></li>
                <li><span><svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9.5 9.5h5v5h-5zM9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/></svg></span>
                    <div><b>${msg("ztbStep2")}</b><small>${msg("ztbStep2Text")}</small></div></li>
                <li><span><svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v4h4M9 12h6M9 16h4"/></svg></span>
                    <div><b>${msg("ztbStep3")}</b><small>${msg("ztbStep3Text")}</small></div></li>
                <li><span><svg viewBox="0 0 24 24"><path d="m12 2.5 8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3L12 2.5Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg></span>
                    <div><b>${msg("ztbStep4")}</b><small>${msg("ztbStep4Text")}</small></div></li>
            </ul>
            <div class="ztb-v-card">
                <span class="ztb-v-pill">ALLOW</span>
                <div><b>Borne A · Lyon</b><small>${msg("ztbCardText")}</small></div>
                <svg viewBox="0 0 24 24"><path d="M12 2.8 19.5 6v5.7c0 4.6-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.9-7.5-9.5V6L12 2.8Z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/></svg>
            </div>
        </div>
    </aside>
</div>
</body>
</html>
</#macro>
