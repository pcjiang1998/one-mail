!macro customInstall
  WriteRegStr HKCU "Software\Classes\OneMailNext.mailto" "" "URL:OneMail Next Mail Protocol"
  WriteRegStr HKCU "Software\Classes\OneMailNext.mailto" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\OneMailNext.mailto\DefaultIcon" "" '"$INSTDIR\OneMailNext.exe",0'
  WriteRegStr HKCU "Software\Classes\OneMailNext.mailto\shell\open\command" "" '"$INSTDIR\OneMailNext.exe" "%1"'

  WriteRegStr HKCU "Software\Clients\Mail\OneMail Next" "" "OneMail Next"
  WriteRegStr HKCU "Software\Clients\Mail\OneMail Next\shell\open\command" "" '"$INSTDIR\OneMailNext.exe"'
  WriteRegStr HKCU "Software\Clients\Mail\OneMail Next\Protocols\mailto" "" "URL:OneMail Next Mail Protocol"
  WriteRegStr HKCU "Software\Clients\Mail\OneMail Next\Protocols\mailto" "URL Protocol" ""
  WriteRegStr HKCU "Software\Clients\Mail\OneMail Next\Protocols\mailto\DefaultIcon" "" '"$INSTDIR\OneMailNext.exe",0'
  WriteRegStr HKCU "Software\Clients\Mail\OneMail Next\Protocols\mailto\shell\open\command" "" '"$INSTDIR\OneMailNext.exe" "%1"'
  WriteRegStr HKCU "Software\Clients\Mail\OneMail Next\Capabilities" "ApplicationName" "OneMail Next"
  WriteRegStr HKCU "Software\Clients\Mail\OneMail Next\Capabilities" "ApplicationDescription" "OneMail Next desktop email client"
  WriteRegStr HKCU "Software\Clients\Mail\OneMail Next\Capabilities" "ApplicationIcon" '"$INSTDIR\OneMailNext.exe",0'
  WriteRegStr HKCU "Software\Clients\Mail\OneMail Next\Capabilities\URLAssociations" "mailto" "OneMailNext.mailto"
  WriteRegStr HKCU "Software\RegisteredApplications" "OneMail Next" "Software\Clients\Mail\OneMail Next\Capabilities"
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\RegisteredApplications" "OneMail Next"
  DeleteRegKey HKCU "Software\Clients\Mail\OneMail Next"
  DeleteRegKey HKCU "Software\Classes\OneMailNext.mailto"
!macroend
