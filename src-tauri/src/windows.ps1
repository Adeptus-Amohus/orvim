$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.Encoding]::UTF8
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$lifeArgs=[Console]::In.ReadToEnd() | ConvertFrom-Json
try {
 switch ($lifeArgs.operation) {
  'credential' {
   Add-Type -AssemblyName System.Security
   if ($lifeArgs.mode -eq 'protect') {
    $bytes=[Text.Encoding]::UTF8.GetBytes($lifeArgs.value)
    $encrypted=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    @{value=[Convert]::ToBase64String($encrypted)} | ConvertTo-Json -Compress
   } else {
    $bytes=[Convert]::FromBase64String($lifeArgs.value)
    $plain=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    @{value=[Text.Encoding]::UTF8.GetString($plain)} | ConvertTo-Json -Compress
   }
  }
  'speech' {
   Add-Type -AssemblyName System.Speech
   $culture=if($lifeArgs.language -eq 'ru'){'ru-RU'}else{'en-US'}
   $engine=[Speech.Recognition.SpeechRecognitionEngine]::new([Globalization.CultureInfo]::new($culture))
   try {
    $engine.LoadGrammar([Speech.Recognition.DictationGrammar]::new())
    $engine.SetInputToDefaultAudioDevice()
    $result=$engine.Recognize([TimeSpan]::FromSeconds(30))
    @{text=if($result){$result.Text}else{''}} | ConvertTo-Json -Compress
   } finally { $engine.Dispose() }
  }
  'notificationPermission' {
   @{message='Разрешите уведомления Orvim в параметрах уведомлений Windows.'} | ConvertTo-Json -Compress
  }
  'notificationClick' { @{kind=''} | ConvertTo-Json -Compress }
  'reminders' {
   $appId='local.lifeos.client'
   $regPath='HKCU:\Software\Classes\AppUserModelId\local.lifeos.client'
   if(!(Test-Path -LiteralPath $regPath)){New-Item -Path $regPath -Force | Out-Null}
   New-ItemProperty -LiteralPath $regPath -Name DisplayName -Value 'Orvim' -PropertyType String -Force | Out-Null
   $protocol='HKCU:\Software\Classes\lifeos-notification'
   New-Item -Path ($protocol+'\shell\open\command') -Force | Out-Null
   New-ItemProperty -LiteralPath $protocol -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
   Set-Item -LiteralPath ($protocol+'\shell\open\command') -Value ('"'+$lifeArgs.executable+'" --notification "%1"')
   [Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null
   [Windows.UI.Notifications.ScheduledToastNotification,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null
   [Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime] | Out-Null
   $notifier=[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId)
   # Delete only the scheduled reminders owned by this app.
   foreach($old in $notifier.GetScheduledToastNotifications()){if($old.Id.StartsWith('lo')){$notifier.RemoveFromSchedule($old)}}
   $now=[DateTimeOffset]::Now
   $until=$now.AddDays(8)
   $queue=[Collections.Generic.List[object]]::new()
   if($lifeArgs.enabled){
    if($lifeArgs.scheduleEnabled -ne $false){foreach($item in $lifeArgs.items){
     # Local date/time is converted again after time-zone changes or daily refresh.
     $at=[DateTimeOffset]::new([DateTime]::ParseExact("$($item.date) $($item.start)",'yyyy-MM-dd HH:mm',$null)).AddMinutes(-5)
     if($at -gt $now -and $at -le $until){$queue.Add(@{id=$item.id;at=$at;title=$item.title;kind='event'})}
    }}
    if($lifeArgs.wellbeingEnabled -ne $false){
     $last=[long]$lifeArgs.lastCheckinAt
     $slots=@($lifeArgs.wellbeingSlots | Where-Object { $_.hour -ge 0 -and $_.hour -le 23 -and $_.start -ge 0 -and $_.start -le $_.hour })
     if($slots.Count -lt 1 -or $slots.Count -gt 6){$slots=@(@{hour=9;start=0},@{hour=15;start=12},@{hour=21;start=18})}
     for($day=0;$day -le 8;$day++){foreach($slot in $slots){
      $date=$now.LocalDateTime.Date.AddDays($day)
      $at=[DateTimeOffset]::new($date.AddHours($slot.hour))
      $period=[DateTimeOffset]::new($date.AddHours($slot.start)).ToUnixTimeMilliseconds()
      if($at -gt $now -and $at -le $until -and !($last -ge $period -and $last -le $now.ToUnixTimeMilliseconds())){$queue.Add(@{id="wellbeing-$($at.ToUnixTimeSeconds())";at=$at;title=if($lifeArgs.language.StartsWith('ru')){'Как вы сейчас?'}else{'How are you feeling?'};kind='wellbeing'})}
     }}
    }
   }
   $count=0
   foreach($item in ($queue | Sort-Object at | Select-Object -First 4000)){
    $title=[Security.SecurityElement]::Escape($item.title)
    $body=if($item.kind -eq 'wellbeing'){if($lifeArgs.language.StartsWith('ru')){'Время отметить самочувствие'}else{'Time for a wellbeing check-in'}}else{if($lifeArgs.language.StartsWith('ru')){'Начало через 5 минут'}else{'Starts in 5 minutes'}}
    $sound=if($item.kind -eq 'wellbeing'){$lifeArgs.wellbeingSound}else{$lifeArgs.scheduleSound}
    $audio=if($lifeArgs.soundEnabled -ne $false -and $sound){"<audio src='$([Security.SecurityElement]::Escape($sound))' loop='false'/>"}else{"<audio silent='true'/>"}
    $xml=[Windows.Data.Xml.Dom.XmlDocument]::new()
    $xml.LoadXml("<toast activationType='protocol' launch='lifeos-notification://$($item.kind)'><visual><binding template='ToastGeneric'><text>$title</text><text>$body</text></binding></visual>$audio</toast>")
    $toast=[Windows.UI.Notifications.ScheduledToastNotification]::new($xml,$item.at)
    $toast.Id='lo'+$count.ToString('D6')
    $notifier.AddToSchedule($toast);$count++
   }
   if(!$lifeArgs.background){
    $planPath=Join-Path $lifeArgs.directory 'reminders.dpapi'
    Add-Type -AssemblyName System.Security
    $planBytes=[Text.Encoding]::UTF8.GetBytes(($lifeArgs | ConvertTo-Json -Depth 15 -Compress))
    $protectedPlan=[Security.Cryptography.ProtectedData]::Protect($planBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllText($planPath,[Convert]::ToBase64String($protectedPlan),[Text.UTF8Encoding]::new($false))
    $legacyPlan=Join-Path $lifeArgs.directory 'reminders.json'
    if([IO.File]::Exists($legacyPlan)){[IO.File]::Delete($legacyPlan)}
    if($lifeArgs.enabled){
     $action=New-ScheduledTaskAction -Execute $lifeArgs.executable -Argument ('--refresh-reminders "'+$lifeArgs.directory+'"')
     $trigger=New-ScheduledTaskTrigger -Daily -At '03:00'
     $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
     $principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
     try {Register-ScheduledTask -TaskName 'Life OS reminders' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null} catch { }
    } else {Unregister-ScheduledTask -TaskName 'Life OS reminders' -Confirm:$false -ErrorAction SilentlyContinue}
   }
   @{message="Напоминания обновлены: $count";scheduled=$count} | ConvertTo-Json -Compress
  }
  default { throw 'Операция недоступна в Windows.' }
 }
} catch { @{error=if($lifeArgs.operation -eq 'credential'){'Не удалось открыть защищённое хранилище Windows.'}else{$_.Exception.Message}} | ConvertTo-Json -Compress }
