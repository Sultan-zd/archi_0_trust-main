<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=realm.password; section>
    <#if section = "header">
        ${msg("ztbLoginTitle")}
    <#elseif section = "subtitle">
        <p class="ztb-sub">${msg("ztbLoginSubtitle")}</p>
    <#elseif section = "form">
        <#if realm.password>
            <#assign hasError = messagesPerField.existsError('username','password')>
            <form id="kc-form-login" class="ztb-form" action="${url.loginAction}" method="post" novalidate
                  onsubmit="var b = document.getElementById('kc-login'); b.disabled = true; b.classList.add('is-busy'); return true;">

                <#if !usernameHidden??>
                    <div class="ztb-field<#if hasError> is-invalid</#if>">
                        <label for="username"><#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if></label>
                        <input id="username" name="username" value="${(login.username!'')}" type="text" autocomplete="username"
                               autocapitalize="none" spellcheck="false" placeholder="${msg('ztbUsernamePlaceholder')}"
                               <#if !(login.username?has_content)>autofocus</#if>
                               aria-invalid="<#if hasError>true<#else>false</#if>" <#if hasError>aria-describedby="input-error"</#if> dir="ltr">
                    </div>
                </#if>

                <div class="ztb-field<#if hasError> is-invalid</#if>">
                    <div class="ztb-label-row">
                        <label for="password">${msg("password")}</label>
                        <#if realm.resetPasswordAllowed>
                            <a class="ztb-link-sm" href="${url.loginResetCredentialsUrl}">${msg("doForgotPassword")}</a>
                        </#if>
                    </div>
                    <div class="ztb-with-action">
                        <input id="password" name="password" type="password" autocomplete="current-password"
                               <#if login.username?has_content || usernameHidden??>autofocus</#if>
                               aria-invalid="<#if hasError>true<#else>false</#if>" <#if hasError>aria-describedby="input-error"</#if> dir="ltr">
                        <button type="button" class="ztb-reveal" aria-controls="password" aria-pressed="false"
                                data-show="${msg('ztbShow')}" data-hide="${msg('ztbHide')}">${msg("ztbShow")}</button>
                    </div>
                    <#if hasError>
                        <span id="input-error" class="ztb-error" aria-live="polite">
                            ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
                        </span>
                    </#if>
                </div>

                <#if realm.rememberMe && !usernameHidden??>
                    <label class="ztb-check">
                        <input id="rememberMe" name="rememberMe" type="checkbox" <#if login.rememberMe??>checked</#if>>
                        <span>${msg("rememberMe")}</span>
                    </label>
                </#if>

                <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                <button class="ztb-btn ztb-btn-primary" name="login" id="kc-login" type="submit">
                    <span class="ztb-spinner" aria-hidden="true"></span>
                    <span class="ztb-btn-label">${msg("doLogIn")}</span>
                    <svg class="ztb-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </button>
            </form>

            <script>
                (function () {
                    var btn = document.querySelector('.ztb-reveal');
                    var input = document.getElementById('password');
                    if (!btn || !input) return;
                    btn.addEventListener('click', function () {
                        var show = input.type === 'password';
                        input.type = show ? 'text' : 'password';
                        btn.textContent = show ? btn.dataset.hide : btn.dataset.show;
                        btn.setAttribute('aria-pressed', String(show));
                        input.focus();
                    });
                })();
            </script>
        </#if>
    <#elseif section = "info">
        <#assign appUrl = ((client.baseUrl)?has_content)?then(client.baseUrl, properties.ztbAppUrl)?remove_ending("/")>
        <p>${msg("ztbNoAccount")} <a href="${appUrl}/inscription">${msg("ztbCreateAccount")}</a></p>
    <#elseif section = "socialProviders">
        <#if realm.password && social?? && social.providers?has_content>
            <div class="ztb-social">
                <span class="ztb-divider">${msg("identity-provider-login-label")}</span>
                <#list social.providers as p>
                    <a id="social-${p.alias}" class="ztb-btn ztb-btn-ghost" href="${p.loginUrl}">${p.displayName!}</a>
                </#list>
            </div>
        </#if>
    </#if>
</@layout.registrationLayout>
