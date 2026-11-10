$ErrorActionPreference='Stop'
$lifeVoiceArgs=[Console]::In.ReadToEnd() | ConvertFrom-Json
$lifeVoiceState=@{text='';partial='';listening=$false;error=$null}
$lifeVoiceStatePath=Join-Path $lifeVoiceArgs.root 'state.json'
function Save-LifeVoice {
  $lifeVoiceTemp=Join-Path $lifeVoiceArgs.root 'state.partial'
  [IO.File]::WriteAllText($lifeVoiceTemp,($lifeVoiceState | ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $lifeVoiceTemp -Destination $lifeVoiceStatePath -Force
}
$lifeVoiceEngine=$null
try {
  Add-Type -AssemblyName System.Speech
  $lifeCulture=if($lifeVoiceArgs.language -eq 'ru'){'ru-RU'}else{'en-US'}
  $lifeVoiceEngine=[Speech.Recognition.SpeechRecognitionEngine]::new([Globalization.CultureInfo]::new($lifeCulture))
  $lifeVoiceEngine.LoadGrammar([Speech.Recognition.DictationGrammar]::new())
  $lifeVoiceEngine.SetInputToDefaultAudioDevice()
  Register-ObjectEvent -InputObject $lifeVoiceEngine -EventName SpeechRecognized -SourceIdentifier LifeVoiceFinal | Out-Null
  Register-ObjectEvent -InputObject $lifeVoiceEngine -EventName SpeechHypothesized -SourceIdentifier LifeVoicePartial | Out-Null
  Register-ObjectEvent -InputObject $lifeVoiceEngine -EventName RecognizeCompleted -SourceIdentifier LifeVoiceEnd | Out-Null
  $lifeVoiceEngine.RecognizeAsync([Speech.Recognition.RecognizeMode]::Multiple)
  $lifeVoiceState.listening=$true
  Save-LifeVoice
  while(!(Test-Path -LiteralPath (Join-Path $lifeVoiceArgs.root 'stop'))) {
    foreach($lifeEvent in @(Get-Event)) {
      if($lifeEvent.SourceIdentifier -eq 'LifeVoiceFinal') {
        $lifeVoiceState.text=($lifeVoiceState.text+' '+$lifeEvent.SourceEventArgs.Result.Text).Trim()
        $lifeVoiceState.partial=''
      } elseif($lifeEvent.SourceIdentifier -eq 'LifeVoicePartial') {$lifeVoiceState.partial=$lifeEvent.SourceEventArgs.Result.Text}
      elseif($lifeEvent.SourceIdentifier -eq 'LifeVoiceEnd' -and !(Test-Path -LiteralPath (Join-Path $lifeVoiceArgs.root 'stop'))) {$lifeVoiceEngine.RecognizeAsync([Speech.Recognition.RecognizeMode]::Multiple)}
      Remove-Event -EventIdentifier $lifeEvent.EventIdentifier
      Save-LifeVoice
    }
    Start-Sleep -Milliseconds 100
  }
  $lifeVoiceEngine.RecognizeAsyncStop()
  $lifeVoiceState.listening=$false
  Save-LifeVoice
} catch {
  $lifeVoiceState.error='Не удалось включить локальный речевой движок Windows. Проверьте микрофон и установку речевого пакета выбранного языка.'
  $lifeVoiceState.listening=$false
  Save-LifeVoice
} finally {if($lifeVoiceEngine){$lifeVoiceEngine.Dispose()}}
