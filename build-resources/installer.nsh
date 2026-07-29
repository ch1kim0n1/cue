; Custom NSIS uninstall hooks for Cue (included via electron-builder nsis.include).

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Also delete Cue settings and API keys?$\r$\n$\r$\nThis removes cue-data.json and cue.log from %APPDATA%\Cue." IDNO cue_keep_data
    Delete "$APPDATA\Cue\cue-data.json"
    Delete "$APPDATA\Cue\cue.log"
    ; Leave Crashpad dumps unless the folder is otherwise empty.
  cue_keep_data:
!macroend
