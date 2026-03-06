import readline from "node:readline";

import type { ExecProcess } from "@earendil-works/gondolin";

export class ShellTerminalAttach {
  private readonly proc: ExecProcess;
  private readonly stdin: NodeJS.ReadStream;
  private readonly stdout: NodeJS.WriteStream;
  private readonly stderr: NodeJS.WriteStream;

  private readonly onStdinData = (chunk: Buffer) => {
    this.proc.write(chunk);
  };

  private readonly onStdinEnd = () => {
    this.proc.end();
  };

  private readonly onResize = () => {
    if (!this.stdout.isTTY) return;
    const cols = this.stdout.columns;
    const rows = this.stdout.rows;
    if (typeof cols === "number" && typeof rows === "number") {
      this.proc.resize(rows, cols);
    }
  };

  private started = false;
  private paused = false;

  constructor(
    proc: ExecProcess,
    stdin: NodeJS.ReadStream = process.stdin,
    stdout: NodeJS.WriteStream = process.stdout,
    stderr: NodeJS.WriteStream = process.stderr,
  ) {
    this.proc = proc;
    this.stdin = stdin;
    this.stdout = stdout;
    this.stderr = stderr;
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    const out = this.proc.stdout;
    const err = this.proc.stderr;
    if (!out || !err) {
      throw new Error('proc must be started with stdout/stderr="pipe"');
    }

    out.pipe(this.stdout, { end: false });
    err.pipe(this.stderr, { end: false });

    if (this.stdin.isTTY) this.stdin.setRawMode(true);
    this.stdin.resume();

    if (this.stdout.isTTY) {
      this.onResize();
      this.stdout.on("resize", this.onResize);
    }

    this.stdin.on("data", this.onStdinData);
    this.stdin.on("end", this.onStdinEnd);
  }

  pause(): void {
    if (!this.started || this.paused) return;
    this.paused = true;
    this.stdin.off("data", this.onStdinData);
    if (this.stdin.isTTY) this.stdin.setRawMode(false);
  }

  resume(): void {
    if (!this.started || !this.paused) return;
    this.paused = false;
    if (this.stdin.isTTY) this.stdin.setRawMode(true);
    this.stdin.on("data", this.onStdinData);
  }

  stop(): void {
    if (!this.started) return;
    this.stdin.off("data", this.onStdinData);
    this.stdin.off("end", this.onStdinEnd);
    if (this.stdout.isTTY) this.stdout.off("resize", this.onResize);
    if (this.stdin.isTTY) this.stdin.setRawMode(false);
    this.stdin.pause();
  }

  async promptDecision(question: string, choices: string): Promise<string> {
    if (!this.stdin.isTTY) {
      this.stderr.write(`${question} (non-interactive, default: deny)\n`);
      return "d";
    }

    this.pause();
    try {
      const rl = readline.createInterface({
        input: this.stdin,
        output: this.stderr,
      });
      const answer = await new Promise<string>((resolve) =>
        rl.question(`${question} ${choices} `, resolve),
      );
      rl.close();
      return answer.trim().toLowerCase();
    } finally {
      this.resume();
    }
  }
}
