import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto'

class Bud {
    constructor(repoPath = '.') {
        this.repoPath = path.join(repoPath, '.bud');
        this.objectsPath = path.join(this.repoPath, 'objects');
        this.headPath = path.join(this.repoPath, 'HEAD');
        this.indexPath = path.join(this.repoPath, 'index');
        this.init()
    }

    async init() {
        await fs.mkdir(this.objectsPath, { recursive: true });
        try {

            await fs.writeFile(this.headPath, '', { flag: 'wx' }); //wx creates the file, fails if already exists
            await fs.writeFile(this.indexPath, JSON.stringify([]), { flag: 'wx' });
        } catch (err) {
            console.log('already a bud repo')
        }
    }

    hashObject(content) {
        return crypto.createHash("sha1").update(content, 'utf-8').digest('hex')
    }

    async add(fileToBeAdded) {
        const fileData = await fs.readFile(fileToBeAdded, { encoding: 'utf-8' });
        const fileHash = this.hashObject(fileData);
        console.log(fileHash);
        const newFileHashObjectPath = path.join(this.objectsPath, fileHash); // .bud/objects/14kjbkfa
        await fs.writeFile(newFileHashObjectPath, fileData);

        await this.updateStagingArea(fileToBeAdded, fileHash);

        console.log('added ', fileToBeAdded)

    }

    async updateStagingArea(filePath, fileHash) {
        const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' }));

        index.push({ path: filePath, hash: fileHash });
        await fs.writeFile(this.indexPath, JSON.stringify(index))
    }

    async commit(message) {
        const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' }));
        const parentCommit = await this.getCurrentHead();

        const commitData = {
            timeStamp: new Date().toISOString(),
            message,
            file: index,
            parent: parentCommit
        };

        const commitHash = this.hashObject(JSON.stringify(commitData));
        const commitPath = path.join(this.objectsPath, commitHash);

        await fs.writeFile(commitPath, JSON.stringify(commitData));
        await fs.writeFile(this.headPath, commitHash); //new head
        await fs.writeFile(this.indexPath, JSON.stringify([]))

        console.log('commit created succesfully ', commitHash)
    }

    async getCurrentHead() {
        try {
            return await fs.readFile(this.headPath, { encoding: 'utf-8' });
        } catch (error) {
            return null;
        }
    }

    async log() {
        let currentCurrentHash = await this.getCurrentHead();

        while (currentCurrentHash) {
            const commitData = JSON.parse(await fs.readFile(path.join(this.objectsPath, currentCurrentHash), { encoding: 'utf-8' }));
            console.log('------------------', '\n');
            console.log('Commit ', currentCurrentHash);
            console.log('Date: ', commitData.timeStamp);
            console.log('message: ', commitData.message);

            currentCurrentHash = commitData.parent;
        }
    }
}

(async () => {
    const bud = new Bud();
    await bud.add('test.txt');
    await bud.commit('third commit');
    await bud.log();
})()

