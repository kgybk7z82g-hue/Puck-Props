Set shell = CreateObject("WScript.Shell")
shell.Run """" & WScript.Arguments(0) & """ --background", 0, False
