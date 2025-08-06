#!/usr/bin/env node

import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { diffLines } from 'diff'
import chalk from 'chalk';
import { Command } from 'commander';

const program = new Command();

class Bud {
    constructor(repoPath = '.') {
        this.repoPath = path.join(repoPath, '.bud');
        this.objectsPath = path.join(this.repoPath, 'objects');
        this.headPath = path.join(this.repoPath, 'HEAD');
        this.indexPath = path.join(this.repoPath, 'index');
    }

    async init() {
        await fs.mkdir(this.objectsPath, { recursive: true });
        try {

            await fs.writeFile(this.headPath, '', { flag: 'wx' }); //wx creates the file, fails if already exists
            await fs.writeFile(this.indexPath, JSON.stringify([]), { flag: 'wx' });
            console.log('Initialized a bud repository')
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
        // console.log(fileHash);
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
            files: index,
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

    async showCommitDiff(commitHash) {
        const commitData = JSON.parse(await this.getCommitData(commitHash));
        if(!commitData) return;

        console.log('changes in the last commits are: ');

        for(const file of commitData.files) {
            console.log('\nFile: ', file.path);
            const fileContent = await this.getFileContent(file.hash);

            console.log('file content: ',fileContent);                      
            
            if(commitData.parent) {                
                const parentCommitData = JSON.parse(await this.getCommitData(commitData.parent));

                const getParentFileContent = await this.getParentFileContent(parentCommitData, file.path);
                
                console.log('\nDiff: ');
                if(getParentFileContent ) {
                    const diff = diffLines(getParentFileContent, fileContent);

                    // console.log(diff);

                    diff.forEach(part => {
                        if(part.added) {
                            process.stdout.write(chalk.green('++' + part.value));
                        } else if(part.removed) {
                            process.stdout.write(chalk.red('--' + part.value));
                        } else {
                            process.stdout.write(chalk.gray('+' + part.value));
                        }
                    })
                    console.log();                    
                } else {
                    console.log(chalk.green('++' + fileContent));
                }
            } else {
                console.log('First commit');                
            }
        }
        
    }

    async getParentFileContent(parentCommitData, filePath) {        
        const parentFile = parentCommitData.files.find(file => file.path == filePath);
        if(parentFile) {
            return await this.getFileContent(parentFile.hash);
        }
    }

    async getCommitData(commitHash) {
        const commitPath = path.join(this.objectsPath, commitHash);
        try {
            return await fs.readFile(commitPath, { encoding: 'utf-8'});
        } catch (error) {
            console.log('failed to read commit data', error.message);
            return null;
        }
    }

    async getFileContent(fileHash) {
        const filePath = path.join(this.objectsPath, fileHash);
        return await fs.readFile(filePath, {encoding: 'utf-8'});
    }
}

// (async () => {
//     const bud = new Bud();
    // await bud.add('test.txt');
    // await bud.add('test2.txt');
    // await bud.commit('second commit');

    // await bud.log();
//     await bud.showCommitDiff('ae450de68776d1bff8971b9bcbc50452102e0370')
// })()

program.command('init').action(async () => {
    const bud = new Bud();
    await bud.init()
});

program.command('add <file>').action(async (file) => {
    const bud = new Bud();
    await bud.add(file);
});

program.command('commit <message>').action(async (message) => {
    const bud = new Bud();
    await bud.commit(message);
});

program.command('log').action(async () => {
    const bud = new Bud();
    await bud.log();
});

program.command('show-diff <commitHash>').action(async (commitHash) => {
    const bud = new Bud();
    await bud.showCommitDiff(commitHash);
});

// console.log(process.argv);
program.parse(process.argv);