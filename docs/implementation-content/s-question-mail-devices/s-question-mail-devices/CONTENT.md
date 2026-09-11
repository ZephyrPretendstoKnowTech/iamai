@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["migrationRequired","relayConnectorReady","verificationRequired"],"format":"powershell","kind":"template"}
param(
 [Parameter(Mandatory=$true)][ValidateSet('Inspect','CreateCertificateRelayConnector','Verify')][string]$Mode,
 [string]$ConnectorName,
 [string]$TlsSenderCertificateName,
 [string[]]$SenderDomains=@('*')
)
$ErrorActionPreference='Stop'
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -ShowBanner:$false
try {
 if($Mode -eq 'Inspect'){
   Get-InboundConnector | Select-Object Name,Enabled,ConnectorType,ConnectorSource,RequireTls,TlsSenderCertificateName,SenderIPAddresses,SenderDomains
   return
 }
 if([string]::IsNullOrWhiteSpace($ConnectorName)){throw 'ConnectorName is required.'}
 if($Mode -eq 'CreateCertificateRelayConnector'){
   if([string]::IsNullOrWhiteSpace($TlsSenderCertificateName)){throw 'TlsSenderCertificateName is required for this safe template.'}
   $existing=@(Get-InboundConnector -Identity $ConnectorName -ErrorAction SilentlyContinue)
   if($existing.Count){throw 'A connector with this identity already exists. Inspect and correct/reuse it; do not duplicate.'}
   New-InboundConnector -Name $ConnectorName -ConnectorType OnPremises -SenderDomains $SenderDomains -TlsSenderCertificateName $TlsSenderCertificateName -RequireTls $true -Enabled $true | Out-Null
 }
 $c=Get-InboundConnector -Identity $ConnectorName
 $c | Select-Object Name,Enabled,ConnectorType,ConnectorSource,RequireTls,TlsSenderCertificateName,SenderIPAddresses,SenderDomains
} finally { Disconnect-ExchangeOnline -Confirm:$false }
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.route","channel":"aiInfo","states":["routeDecisionRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

For {{tenant.displayName}}, compare the actual capabilities of {{mail.devices}} against the supported choices. Do not pick SMTP relay unless the relay prerequisites are proven; do not recommend Basic authentication as the target design.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.migrate","channel":"aiInfo","states":["migrationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the chosen route {{mail.route}} for {{mail.devices}}. Identify only the remaining manual device/app and Exchange steps; never request or reproduce passwords.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.relay","channel":"aiInfo","states":["relayConnectorReady"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the proposed certificate-authenticated relay connector. Confirm the certificate identity, accepted domain/sender requirements, TCP 25, and that an equivalent connector does not already exist.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Summarize what must be proven before the old service account can leave the exception group: successful mail delivery, recipient scope, message trace/device logs, and absence of the old password-based sign-in.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the blocker without inventing a mail route, IP address, certificate, or credential: {{dependencies.blockers}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.owner","channel":"email","states":["routeDecisionRequired"],"format":"markdown","kind":"template"}
Subject: Confirm mail-sending device requirements

We need the current sending method, whether the device can use OAuth/TLS, whether it sends only internally or to internet recipients, and whether its network has a static public IP or suitable TLS certificate. We will choose a supported route from those facts rather than weaken Conditional Access.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.device-owner","channel":"email","states":["migrationRequired"],"format":"markdown","kind":"template"}
Subject: Mail-device migration and test

We are moving the listed device/application off its current password-dependent mail path. Please provide a test window and a recipient we can verify. We will keep the existing route available until the replacement sends successfully and is visible in logs.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["routeDecisionRequired","migrationRequired","relayConnectorReady","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"devices","label":"Mail-sending devices","result":{{json:mail.devices}},"line":"Each device needs a route based on actual capability."},{"id":"route","label":"Chosen route","result":{{json:mail.route}},"line":"OAuth and SMTP relay have different prerequisites."},{"id":"connector","label":"Relay connector","result":{{json:mail.connector.name}},"line":"Create one only when relay is chosen and identity is proven."}],"whyIamaiSaysThis":"Legacy-authentication enforcement must not strand a printer or application that still sends mail with a password."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["migrationRequired","relayConnectorReady","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"relay-rejected","classification":"documented","symptom":"Exchange Online rejects relay from the device/application.","check":"Verify MX endpoint, TCP 25, accepted sender domain, and the certificate/source identity expected by the connector.","fix":"Correct only the failed relay prerequisite; do not enable a broad/open relay.","then":"Retest and inspect message trace/device logs.","sources":["ms-device-mail","ms-connectors"]},{"id":"smtp-auth-disabled","classification":"documented","symptom":"Client SMTP submission fails even though the device has valid credentials.","check":"Confirm whether SMTP AUTH is disabled tenant-wide or on the mailbox and whether the client supports OAuth.","fix":"Use OAuth if client SMTP submission is the chosen route, or move to another supported mail path.","then":"Retest without Basic authentication.","sources":["ms-smtp-auth"]},{"id":"external-recipient-fails","classification":"documented","symptom":"Internal delivery works but internet recipients fail.","check":"Confirm the chosen method supports external relay; Direct Send does not relay to external recipients.","fix":"Use a supported authenticated submission or relay design that matches the recipient requirement.","then":"Retest both internal and external recipients.","sources":["ms-device-mail"]},{"id":"legacy-account-left-exempt","classification":"derived","symptom":"The new route works but the old service account remains in the exception group.","check":"Confirm the old credential is no longer used by device/application logs or sign-in evidence.","fix":"Remove the obsolete account through Create or Correct Service Accounts Group; do not edit unrelated policies here.","then":"Rescan IAMAI.","sources":["ms-device-mail"]}]}
@@IAMAI-END
