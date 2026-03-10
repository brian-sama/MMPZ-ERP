import { spawn, spawnSync } from 'child_process';

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node scripts/docker_compose.js <compose args>');
    process.exit(1);
}

const candidates = ['docker'];
if (process.platform === 'win32') {
    candidates.push(
        'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
        'C:\\ProgramData\\DockerDesktop\\version-bin\\docker.exe'
    );
}

const resolveDocker = () => {
    for (const candidate of candidates) {
        try {
            const check = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
            if (check.status === 0) {
                return candidate;
            }
        } catch {
            // Try next candidate.
        }
    }
    return null;
};

const dockerBin = resolveDocker();
if (!dockerBin) {
    console.error('Docker CLI not found. Install Docker Desktop or add docker to PATH.');
    process.exit(1);
}

const composeArgs = ['compose', '-f', 'docker-compose.local.yml', ...args];
const child = spawn(dockerBin, composeArgs, {
    stdio: 'inherit',
    shell: false,
});

const forwardSignal = (signal) => {
    if (!child.killed) {
        child.kill(signal);
    }
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code) => {
    process.exit(code ?? 1);
});

