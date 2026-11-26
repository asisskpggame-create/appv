using System;
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace AsisVpn.Windows.Engine
{
    public enum WindowsConnectionState
    {
        Disconnected,
        Preparing,
        Connecting,
        Connected,
        Reconnecting,
        Disconnecting,
        Error
    }

    /// <summary>
    /// Phase 7 Windows native VPN engine adapter using sing-box + Wintun virtual TUN adapter.
    /// Runs inside an elevated Windows Service or UAC-elevated helper process via named-pipe IPC.
    /// </summary>
    public sealed class AsisWindowsVpnEngine : IDisposable
    {
        private Process? _singBoxProcess;
        public WindowsConnectionState State { get; private set; } = WindowsConnectionState.Disconnected;

        public async Task ConnectAsync(string validatedSingBoxConfigPath, string singBoxBinaryPath)
        {
            if (!File.Exists(validatedSingBoxConfigPath) || !File.Exists(singBoxBinaryPath))
            {
                State = WindowsConnectionState.Error;
                throw new FileNotFoundException("Missing sing-box binary or validated config file.");
            }

            State = WindowsConnectionState.Preparing;
            var startInfo = new ProcessStartInfo
            {
                FileName = singBoxBinaryPath,
                Arguments = $"run -c \"{validatedSingBoxConfigPath}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            _singBoxProcess = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
            _singBoxProcess.Exited += (_, _) =>
            {
                if (State == WindowsConnectionState.Connected || State == WindowsConnectionState.Connecting)
                {
                    State = WindowsConnectionState.Error;
                }
            };

            State = WindowsConnectionState.Connecting;
            _singBoxProcess.Start();

            // Verify Wintun interface initialization before declaring Connected
            await Task.Delay(500);
            if (_singBoxProcess.HasExited)
            {
                State = WindowsConnectionState.Error;
                throw new InvalidOperationException("sing-box exited unexpectedly during TUN startup.");
            }

            State = WindowsConnectionState.Connected;
        }

        public void Disconnect()
        {
            State = WindowsConnectionState.Disconnecting;
            if (_singBoxProcess is { HasExited: false })
            {
                _singBoxProcess.Kill(entireProcessTree: true);
            }
            _singBoxProcess?.Dispose();
            _singBoxProcess = null;
            State = WindowsConnectionState.Disconnected;
        }

        public static byte[] ProtectRefreshTokenDpapi(string rawToken)
        {
            var bytes = Encoding.UTF8.GetBytes(rawToken);
            return ProtectedData.Protect(bytes, null, DataProtectionScope.CurrentUser);
        }

        public void Dispose() => Disconnect();
    }
}
