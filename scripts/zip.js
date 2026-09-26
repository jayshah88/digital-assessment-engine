import fs from 'fs';
import { resolve } from 'path';
import { ZipArchive } from 'archiver';

async function run() {
  const zipPath = resolve('../digital-assessment-engine.zip');

  console.log('Cleaning up previous zip...');
  if (fs.existsSync(zipPath)) {
    try {
      fs.unlinkSync(zipPath);
      console.log('Previous zip deleted.');
    } catch (err) {
      console.warn('Could not delete previous zip');
    }
  }

  // Create a file to write archive data to
  const output = fs.createWriteStream(zipPath);
  const archive = new ZipArchive({
    zlib: { level: 9 } // Sets the compression level to maximum
  });

  // Listen for all archive data to be written
  output.on('close', function () {
    console.log(`\n🎉 Success! WordPress-standard plugin packaged successfully at:\n${zipPath}\n`);
    console.log(`${archive.pointer()} total bytes`);
  });

  // Good practice to catch warnings and errors
  archive.on('warning', function (err) {
    if (err.code === 'ENOENT') {
      console.warn('Archive entry not found');
    } else {
      throw err;
    }
  });

  archive.on('error', function (err) {
    throw err;
  });

  // Pipe archive data to the file
  archive.pipe(output);

  const filesToZip = [
    'assets',
    'includes',
    'languages',
    'templates',
    'digital-assessment-engine.php',
    'uninstall.php',
    'block.json',
    'readme.txt'
  ];

  console.log('Adding files and directories to ZIP archive...');
  for (const item of filesToZip) {
    const srcPath = resolve(item);
    if (fs.existsSync(srcPath)) {
      const stats = fs.statSync(srcPath);
      if (stats.isDirectory()) {
        console.log(`Adding folder: ${item}`);
        // We set the target prefix to 'digital-assessment-engine/item' so it extracts nicely.
        // archiver's directory() method automatically translates all paths to forward slashes.
        archive.directory(srcPath, `digital-assessment-engine/${item}`);
      } else {
        console.log(`Adding file: ${item}`);
        archive.file(srcPath, { name: `digital-assessment-engine/${item}` });
      }
    } else {
      console.warn(`File/Directory not found: ${item}`);
    }
  }

  // Finalize the archive (ie we are done appending files but streams have to finish yet)
  await archive.finalize();
}

run().catch((err) => {
  console.error('\n❌ Packaging failed completely:', err.message);
  process.exit(1);
});
