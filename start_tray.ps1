Add-Type -AssemblyName System.Windows.Forms, System.Drawing

# 1. Start npx serve in background (using -y to auto-install and setting working directory)
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cmd.exe"
$psi.Arguments = "/c npx -y serve -s dist -l 8080"
$psi.WorkingDirectory = $PSScriptRoot
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$psi.CreateNoWindow = $true
$process = [System.Diagnostics.Process]::Start($psi)

# 2. Create System Tray Icon
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
$notifyIcon.Text = "Auto-GAO Server (Port 8080)"
$notifyIcon.Visible = $true

# 3. Create Context Menu
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = New-Object System.Windows.Forms.ToolStripMenuItem("Open Webpage")
$exitItem = New-Object System.Windows.Forms.ToolStripMenuItem("Exit")

$contextMenu.Items.Add($openItem) | Out-Null
$contextMenu.Items.Add($exitItem) | Out-Null
$notifyIcon.ContextMenuStrip = $contextMenu

# 4. Bind Menu Click Events
$openItem.Add_Click({
    [System.Diagnostics.Process]::Start("http://localhost:8080")
})

$exitItem.Add_Click({
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    if (!$process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    # Clean up node background processes in PowerShell 5.1/7 using CIM/WMI
    Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*serve*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    [System.Windows.Forms.Application]::Exit()
    Exit
})

# Double click tray icon opens webpage
$notifyIcon.Add_DoubleClick({
    [System.Diagnostics.Process]::Start("http://localhost:8080")
})

# 5. Start Message Loop
[System.Windows.Forms.Application]::Run()
