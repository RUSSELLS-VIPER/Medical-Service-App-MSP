const fs = require('fs');
const path = require('path');

const root = process.cwd();
const outputRoot = path.join(root, '.amplify-hosting');
const computeRoot = path.join(outputRoot, 'compute', 'default');
const staticRoot = path.join(outputRoot, 'static');

function rmIfExists(target) {
    if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
    }
}

function ensureDir(target) {
    fs.mkdirSync(target, { recursive: true });
}

function copyItem(srcRel, destAbs) {
    const srcAbs = path.join(root, srcRel);
    if (!fs.existsSync(srcAbs)) return;
    fs.cpSync(srcAbs, destAbs, { recursive: true });
}

function copyPublicWithoutUploads(destAbs) {
    const publicSrc = path.join(root, 'public');
    if (!fs.existsSync(publicSrc)) return;
    fs.cpSync(publicSrc, destAbs, {
        recursive: true,
        filter: (src) => {
            const rel = path.relative(publicSrc, src);
            if (!rel) return true;
            const normalized = rel.replace(/\\/g, '/');
            return !(normalized === 'uploads' || normalized.startsWith('uploads/'));
        }
    });
}

rmIfExists(outputRoot);
ensureDir(computeRoot);
ensureDir(staticRoot);

copyItem('index.js', path.join(computeRoot, 'index.js'));
copyItem('package.json', path.join(computeRoot, 'package.json'));
copyItem('package-lock.json', path.join(computeRoot, 'package-lock.json'));
copyItem('app', path.join(computeRoot, 'app'));
copyItem('views', path.join(computeRoot, 'views'));
copyPublicWithoutUploads(path.join(computeRoot, 'public'));
copyItem('node_modules', path.join(computeRoot, 'node_modules'));
copyPublicWithoutUploads(staticRoot);
copyItem('deploy-manifest.json', path.join(outputRoot, 'deploy-manifest.json'));

console.log('Amplify hosting bundle generated at .amplify-hosting');
