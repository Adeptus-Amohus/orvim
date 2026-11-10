$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.Encoding]::UTF8
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$request=[Console]::In.ReadToEnd() | ConvertFrom-Json
try {
  $program=[IO.Path]::GetFullPath([string]$request.executable)
  if (!(Test-Path -LiteralPath $program -PathType Leaf) -or [IO.Path]::GetExtension($program) -ne '.exe') { throw 'Не найден файл Orvim.' }
  if ($request.operation -eq 'lanFirewallRepair') {
    $pathData=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($program))
    # The executable path is data, never executable PowerShell source.
    $repair=@'
$ErrorActionPreference='Stop'
try {
  $program=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__ORVIM_PATH__'))
  if (!(Test-Path -LiteralPath $program -PathType Leaf)) { exit 2 }
  $hasher=[Security.Cryptography.SHA256]::Create()
  try {$tag=([BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($program.ToLowerInvariant())))).Replace('-','').Substring(0,12)} finally {$hasher.Dispose()}
  foreach ($entry in @(@{Protocol='TCP';Port=42673},@{Protocol='UDP';Port=42674})) {
    $name='Orvim-LAN-'+$tag+'-'+$entry.Protocol
    $old=Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue
    if ($old) { Remove-NetFirewallRule -Name $name }
    New-NetFirewallRule -Name $name -DisplayName ('Orvim local network '+$entry.Protocol) -Description 'Managed by Orvim. Private local subnet only.' -Direction Inbound -Action Allow -Enabled True -Profile Private -Program $program -Protocol $entry.Protocol -LocalPort $entry.Port -RemoteAddress LocalSubnet -EdgeTraversalPolicy Block | Out-Null
  }
  exit 0
} catch {exit 1}
'@
    $repair=$repair.Replace('__ORVIM_PATH__',$pathData)
    $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($repair))
    try {
      $process=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',$encoded) -Verb RunAs -WindowStyle Hidden -Wait -PassThru
    } catch {throw 'Разрешение не изменено. Подтвердите запрос Windows или настройте брандмауэр вручную.'}
    if ($process.ExitCode -ne 0) {throw 'Windows не разрешил настроить доступ. Проверьте права администратора.'}
  } elseif ($request.operation -ne 'lanFirewallStatus') { throw 'Неизвестное действие сети.' }
  $policy=New-Object -ComObject HNetCfg.FwPolicy2
  $tcp=$false; $udp=$false
  foreach ($rule in $policy.Rules) {
    if (!$rule.Enabled -or $rule.Direction -ne 1 -or $rule.Action -ne 1 -or (($rule.Profiles -band 2) -eq 0)) {continue}
    $app=[string]$rule.ApplicationName
    if ($app -and [Environment]::ExpandEnvironmentVariables($app) -ine $program) {continue}
    $ports=([string]$rule.LocalPorts).Split(',')
    $allPorts=!$rule.LocalPorts -or $ports -contains '*'
    if (($rule.Protocol -in @(6,256)) -and ($allPorts -or $ports -contains '42673')) {$tcp=$true}
    if (($rule.Protocol -in @(17,256)) -and ($allPorts -or $ports -contains '42674')) {$udp=$true}
  }
  $enabled=$policy.FirewallEnabled(2)
  @{available=$true;ready=(!$enabled -or ($tcp -and $udp));tcpAllowed=$tcp;discoveryAllowed=$udp;privateFirewallEnabled=$enabled;message=if(!$enabled){'Брандмауэр частной сети Windows выключен.'}elseif($tcp -and $udp){'Разрешающие правила Windows для частной сети найдены.'}else{'Windows ещё не разрешил все подключения Orvim в частной сети.'}} | ConvertTo-Json -Compress
} catch { @{available=$false;ready=$false;error=$_.Exception.Message;message='Не удалось проверить разрешения Windows.'} | ConvertTo-Json -Compress }
