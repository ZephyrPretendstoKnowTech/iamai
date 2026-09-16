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

{{tenant.displayName}} has mail-sending devices or applications that need a supported route before legacy authentication is blocked: {{mail.devices}}. No route is chosen yet.

Supported routes include SMTP AUTH client submission with OAuth, SMTP relay through an Exchange Online inbound connector (which needs a certificate or a static public IP address, and TCP 25) and Direct Send (internal recipients only). Keeping an account in a Conditional Access exception group does not keep Basic SMTP AUTH working once Exchange Online no longer accepts it.

NEXT STEP: Explain which device facts decide the route (authentication and TLS support, recipient requirements, network identity), which are still missing, and which route fits. Do not recommend Basic authentication as the target.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.migrate","channel":"aiInfo","states":["migrationRequired"],"format":"markdown","kind":"template"}

The chosen route is {{mail.route}} for {{mail.devices}}. Moving to it means configuring the device or application, setting up any Exchange Online connector the route needs, and proving delivery with test messages. Keep the existing route available until the replacement sends successfully.

NEXT STEP: Explain the remaining device, application and Exchange Online steps for this route, and the test messages that will show delivery works. Never ask for or repeat a password.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.relay","channel":"aiInfo","states":["relayConnectorReady"],"format":"markdown","kind":"template"}

SMTP relay is the chosen route, and a certificate-based inbound connector is the next change. Creating the connector does not configure the device or prove delivery.

NEXT STEP: Explain how to confirm the certificate name the connector will expect, the accepted domain and sender domains, that the device can reach the tenant's MX endpoint on TCP 25, and that no equivalent connector already exists.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

This step is waiting for proof that the replacement route works. The old service account stays in the exception group until then.

NEXT STEP: Explain the evidence needed before removing it: successful delivery to each required recipient type (including external recipients where needed), message trace or device logs, and no further sign-ins with the old password. Removal happens in the service-accounts group step, after checking that nothing else still uses the account.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

This mail-route step is on hold: {{dependencies.blockers}}. Do not assume a mail route, IP address, certificate or credential that the facts do not show.

NEXT STEP: Explain what must be resolved before a route can be chosen or tested.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.owner","channel":"email","states":["routeDecisionRequired","blocked","missing"],"format":"markdown","kind":"template","audience":"device-owner","communicationTrigger":"before choosing and testing the implementation route"}
Subject: Action needed: Set Up an SMTP Relay for Mail-Sending Devices

Please send IT the device's current mail settings, supported authentication methods, recipient requirements and a suitable test window. Please also tell us whether its network has a static public IP address or a suitable TLS certificate. Do not send its password.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.device-owner","channel":"email","states":["migrationRequired"],"format":"markdown","kind":"template","audience":"device-owner"}
Subject: Action needed: Set Up an SMTP Relay for Mail-Sending Devices

We plan to move the device or application off its current password-based way of sending mail. Please provide a test window and a recipient we can check. We will keep the existing route available until the replacement sends successfully and delivery is confirmed. Do not send its password.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["routeDecisionRequired","migrationRequired","relayConnectorReady","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"devices","label":"Mail-sending devices","result":{{json:mail.devices}},"line":"Each device needs a route based on actual capability."},{"id":"route","label":"Chosen route","result":{{json:mail.route}},"line":"Confirm the device's capabilities, recipient needs and chosen route. An exception group cannot restore a service-side authentication method that is unavailable."},{"id":"connector","label":"Relay connector","result":{{json:mail.connector.name}},"line":"Create one only when relay is chosen and identity is proven."}],"whyIamaiSaysThis":"Legacy-authentication enforcement must not strand a printer or application that still sends mail with a password."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["migrationRequired","relayConnectorReady","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"relay-rejected","classification":"documented","symptom":"Exchange Online rejects relay from the device/application.","check":"Verify MX endpoint, TCP 25, accepted sender domain, and the certificate/source identity expected by the connector.","fix":"Correct only the failed relay prerequisite; do not enable a broad/open relay.","then":"Retest and inspect message trace/device logs.","sources":["ms-device-mail","ms-connectors"]},{"id":"smtp-auth-disabled","classification":"documented","symptom":"Client SMTP submission fails even though the device has valid credentials.","check":"Confirm whether SMTP AUTH is disabled tenant-wide or on the mailbox and whether the client supports OAuth.","fix":"Use OAuth if client SMTP submission is the chosen route, or move to another supported mail path.","then":"Retest without Basic authentication.","sources":["ms-smtp-auth"]},{"id":"external-recipient-fails","classification":"documented","symptom":"Internal delivery works but internet recipients fail.","check":"Confirm the chosen method supports external relay; Direct Send does not relay to external recipients.","fix":"Use a supported authenticated submission or relay design that matches the recipient requirement.","then":"Retest both internal and external recipients.","sources":["ms-device-mail"]},{"id":"legacy-account-left-exempt","classification":"derived","symptom":"The new route works but the old service account remains in the exception group.","check":"Confirm the old credential is no longer used by device/application logs or sign-in evidence.","fix":"Remove the obsolete account through Create or Correct Service Accounts Group; do not edit unrelated policies here.","then":"Rescan IAMAI.","sources":["ms-device-mail"]}]}
@@IAMAI-END
