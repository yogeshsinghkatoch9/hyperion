#!/usr/bin/env python3
"""PTY bridge — spawns a real pseudo-terminal shell and relays I/O via stdin/stdout as JSON lines."""
import pty, os, sys, select, json, signal, struct, fcntl, termios

def main():
    shell = '/bin/zsh' if os.path.exists('/bin/zsh') else '/bin/bash'

    # Get initial size from args
    cols = int(sys.argv[1]) if len(sys.argv) > 1 else 120
    rows = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    cwd = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('HOME', '/')

    # Clean env
    env = dict(os.environ)
    env.pop('CLAUDECODE', None)
    env.pop('CLAUDE_CODE', None)
    env['TERM'] = 'xterm-256color'
    env['COLORTERM'] = 'truecolor'

    # Fork with PTY
    pid, master_fd = pty.fork()

    if pid == 0:
        # Child — exec shell
        os.chdir(cwd)
        os.execvpe(shell, [shell, '-l'], env)
        sys.exit(1)

    # Parent — relay I/O
    # Set initial window size
    winsize = struct.pack('HHHH', rows, cols, 0, 0)
    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)

    # Make stdin non-blocking
    import threading

    def read_stdin():
        """Read JSON lines from stdin and write to PTY master."""
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
                if msg.get('type') == 'input':
                    os.write(master_fd, msg['data'].encode('utf-8'))
                elif msg.get('type') == 'resize':
                    c = msg.get('cols', 120)
                    r = msg.get('rows', 30)
                    winsize = struct.pack('HHHH', r, c, 0, 0)
                    try:
                        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                        os.kill(pid, signal.SIGWINCH)
                    except:
                        pass
            except:
                pass

    stdin_thread = threading.Thread(target=read_stdin, daemon=True)
    stdin_thread.start()

    # Read from PTY master and write JSON lines to stdout
    try:
        while True:
            try:
                r, _, _ = select.select([master_fd], [], [], 0.05)
                if master_fd in r:
                    data = os.read(master_fd, 16384)
                    if not data:
                        break
                    # Write as JSON line
                    out = json.dumps({'type': 'output', 'data': data.decode('utf-8', errors='replace')})
                    sys.stdout.write(out + '\n')
                    sys.stdout.flush()
            except OSError:
                break
    except KeyboardInterrupt:
        pass

    # Wait for child
    try:
        _, status = os.waitpid(pid, 0)
        code = os.WEXITSTATUS(status) if os.WIFEXITED(status) else 1
    except:
        code = 0

    out = json.dumps({'type': 'exit', 'code': code})
    sys.stdout.write(out + '\n')
    sys.stdout.flush()

if __name__ == '__main__':
    main()
