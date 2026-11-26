Attribute VB_Name = "MeMeetPostvak"
' MeMeet - mails als .msg opslaan in het postvak van MeMeet (uitbreiding Postvak)
'
' Werkt alleen in de klassieke Outlook (de nieuwe Outlook kent geen macro's).
' Installeren: Alt+F11 > Invoegen > Module > deze code plakken > opslaan.
' Gebruiken:   selecteer een of meer mails en start NaarPostvak (Alt+F8),
'              of kies in een regel de actie "een script uitvoeren" > NaarPostvakRegel.
'              Scripts in regels werken alleen als je organisatie dat toestaat.
'
' Zet hieronder het pad naar je postvak (de map die je in MeMeet als postvak hebt gekozen).
Const POSTVAK As String = "C:\Users\JOUWNAAM\MeMeet-postvak\"

' De geselecteerde mails in het postvak zetten
Public Sub NaarPostvak()
    Dim sel As Outlook.Selection, i As Long, n As Long
    Set sel = Application.ActiveExplorer.Selection
    For i = 1 To sel.Count
        If TypeOf sel.Item(i) Is Outlook.MailItem Or TypeOf sel.Item(i) Is Outlook.MeetingItem Then
            SlaOp sel.Item(i)
            n = n + 1
        End If
    Next
    MsgBox n & " mail(s) in het postvak gezet.", vbInformation, "MeMeet"
End Sub

' Voor een Outlook-regel met de actie "een script uitvoeren"
Public Sub NaarPostvakRegel(itm As Outlook.MailItem)
    SlaOp itm
End Sub

Private Sub SlaOp(itm As Object)
    Dim pad As String, naam As String, tmp As String
    pad = POSTVAK
    If Right(pad, 1) <> "\" Then pad = pad & "\"
    naam = Format(itm.ReceivedTime, "yyyy-mm-dd hh.nn") & " " & SchoneNaam(itm.Subject)
    If Len(naam) > 120 Then naam = Left(naam, 120)
    ' Eerst onder een tijdelijke naam opslaan en daarna hernoemen. MeMeet slaat bestanden over die met ~ beginnen
    ' of op .tmp eindigen, en pakt zo nooit een half opgeslagen mail op.
    tmp = pad & "~" & naam & ".tmp"
    itm.SaveAs tmp, olMSG
    Name tmp As pad & UniekeNaam(pad, naam, ".msg")
End Sub

Private Function SchoneNaam(s As String) As String
    Dim t As String, c As Variant
    t = s
    For Each c In Array("\", "/", ":", "*", "?", """", "<", ">", "|", vbTab, vbCr, vbLf)
        t = Replace(t, c, "_")
    Next
    t = Trim(t)
    If t = "" Then t = "Mail"
    SchoneNaam = t
End Function

Private Function UniekeNaam(pad As String, naam As String, ext As String) As String
    Dim kandidaat As String, n As Long
    kandidaat = naam & ext
    n = 1
    Do While Dir(pad & kandidaat) <> ""
        n = n + 1
        kandidaat = naam & " (" & n & ")" & ext
    Loop
    UniekeNaam = kandidaat
End Function
