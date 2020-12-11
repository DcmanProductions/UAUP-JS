
////////////////////    IMPORTING    ////////////////////
//#region IMPORTING
const request = require('request');
const fs = require('fs');
//#endregion IMPORTING

////////////////////    GLOBAL VARIABLES    ////////////////////
//#region GLOBAL VARIABLES
var app_library = (process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")) + "\\";

var git_api;
var new_version = "unknown";
var current_version = "unknown";

var dl_bar;
var dl_label;

var defaultOptions = {
    useGithub: true,
    gitRepo: "unknown",
    gitUsername: "unknown",
    isGitRepoPrivate: false,
    gitRepoToken: "uknown",

    appName: "unknown",
    appExecutableName: this.appName + "",

    appDirectory: app_library + this.appName,
    versionFile: this.appDirectory + "/settings/version.json",
    tempDirectory: this.appDirectory + "/tmp",

    progressBar: null,
    label: null,
    forceUpdate: false
};
//#endregion GLOBAL VARIABLES


////////////////////    INITIALIZATION    ////////////////////
//#region INITIALIZATION
/**
 * Tests if the Required Fields are Filled out
 * @param {defaultOptions} options 
 */
function testOptions(options) {
    return !(options.appName === "unknown" || (options.useGithub && (options.gitUsername === "unknown" || options.gitRepo === "unknown")) || (options.isGitRepoPrivate && options.gitRepoToken === "unknown"));
}

/**
 * Updates Global Variables based on the Provided Options
 * @param {defaultOptions} options 
 */
function setOptions(options) {
    // Sets the Default Values
    options.useGithub = options.useGithub == null ? true : options.appDirectory;
    options.forceUpdate = options.forceUpdate == null ? false : options.forceUpdate;
    options.appDirectory = options.appDirectory == null ? app_library + options.appName : options.appDirectory;
    options.versionFile = options.versionFile == null ? options.appDirectory + "\\settings\\version.json" : options.versionFile;
    options.tempDirectory = options.tempDirectory == null ? options.appDirectory + "\\tmp" : options.tempDirectory;
    options.appExecutableName = options.appExecutableName == null ? options.appName : options.appExecutableName;

    // Sets the Elements (if used)
    if (options.label !== null)
        dl_label = options.label;
    if (options.progressBar !== null)
        dl_bar = options.progressBar;
    if (options.useGithub)
        setupGitProtocol(options);
    return options;
}


/**
 * Sets the Values for GitHub based on the Options Provieded.
 * @param {defaultOptions} options 
 */
function setupGitProtocol(options) {
    options.gitRepo = options.gitRepo.toString().replace('/ /gi', '-');
    git_api = `https://api.github.com/repos/${options.gitUsername}/${options.gitRepo}/releases/latest`;
}


/**
 * Creates the Required Directories for the Application to Run
 * @param {defaultOptions} options 
 */
function createDirectories(options) {
    if (!fs.existsSync(options.appDirectory))
        fs.mkdirSync(options.appDirectory);
    if (!fs.existsSync(options.tempDirectory))
        fs.mkdirSync(options.tempDirectory);
    if (!fs.existsSync(require('path').dirname(options.versionFile)))
        fs.mkdirSync(require('path').dirname(options.versionFile));
}

//#endregion INITIALIZATION


////////////////////    VERSIONING    ////////////////////
//#region VERSIONING

/**
 * Gets the Direct Download URL From the GitHub API.
 * @param {defaultOptions} options
 * @returns {*} The Direct Download URL
 */
async function GetUpdateURL(options) {

    return fetch(git_api).then(response => response.json()).then(data => { json = data; }).catch(e => {
        try {
            // Electron
            alert(`Something went wrong: ${e}`);
        } catch {
            // NodeJS
            console.error(`Something went wrong: ${e}`);
            return;
        }
    }).then(() => {
        let zip;
        for (i = 0; i < json['assets'].length; i++) {
            if (json['assets'][i]['content_type'] === 'application/zip' && json['assets'][i]['name'] === `${options.appName}.zip`) zip = json['assets'][i];
        }
        return zip['browser_download_url'];
    });
}

/**
 * Gets the current relase version from GitHub
 */
async function GetUpdateVersion() {
    return fetch(git_api).then(response => response.json()).then(data => { json = data; }).catch(e => {
        try {
            // Electron
            alert(`Something went wrong: ${e}`);
        } catch {
            // NodeJS
            console.error(`Something went wrong: ${e}`);
            return;
        }
    }).then(() => {
        new_version = json['tag_name'];
        return json['tag_name'];
    });
}

/**
 * Gets the Current Version from the File System
 * @param {defaultOptions} options 
 */
function GetCurrentVersion(options) {
    return JSON.parse(fs.readFileSync(options.versionFile, (err, data) => {
        if (err) throw err;
    }))['game_version'];
}

/**
 * Updates the Version File to Reflect the New Version
 * @param {defaultOptions} options 
 */
function UpdateCurrentVersion(options) {
    let version = {
        game_version: new_version,
        last_updated: Date.now().toString()
    };
    fs.writeFileSync(options.versionFile, JSON.stringify(version));
}
//#endregion VERSIONING


////////////////////    LOGGING    ////////////////////
//#region LOGGING


/**
 * Updates the Progressbar, if any, and logs the percentage to console.
 * @param {number} rb - Bytes already Downloaded
 * @param {number} tb - Total Bytes to Download
 */
function showProgress(rb, tb) {
    console.log(`${Math.floor((rb * 100) / tb)}% | ${rb} bytes of ${tb} bytes`);
    if (dl_bar !== null)
        dl_bar.setAttribute('value', (rb * 100) / tb);
}

/**
 * Updates the Status Label, if any, and Logs the value.
 * @param {string} value
 */
function updateHeader(value) {
    console.log(value);
    if (dl_label !== null)
        dl_label.innerHTML = value;
}

//#endregion LOGGING

////////////////////    STAGES    ////////////////////
//#region STAGES

/**
 * Updates the Application based on the Provided Options
 * @param {defaultOptions} options 
 */
async function Update(options = defaultOptions) {
    if (testOptions(options)) {
        options = setOptions(options);
        createDirectories(options);
        if (options.forceUpdate || await CheckForUpdates(options)) {
            updateHeader('Downloading Update');
            let url = await GetUpdateURL(options);
            Download(url, `${options.tempDirectory}\\${options.appName}.zip`, options);
            UpdateCurrentVersion(options);
        } else {
            updateHeader("No Update Found");
            setTimeout(() => LaunchApplication(options), 1500);
        }
    } else {
        try {
            // Electron
            alert(`Please Fill out the Options Fully`);
            window.close();
        } catch {
            // NodeJS
            console.log(`Please Fill out the Options Fully`);
            return;
        }
    }
}

/**
 * Checks if there are any updates
 * @param {defaultOptions} options 
 * @returns {*} true if an update is needed and false if not
 */
async function CheckForUpdates(options = defaultOptions) {
    if (testOptions(options)) {
        options = setOptions(options);
        createDirectories(options);
        updateHeader('Checking for Updates');
        if (fs.existsSync(options.versionFile)) {
            current_version = GetCurrentVersion(options);
            if (current_version == "unknown") {
                console.error('Unable to Load Current Version... Trying again');
                return CheckForUpdates(options);
            }
            return current_version !== await GetUpdateVersion();
        } else {
            alert("Couln't find the Version File")
            return true;
        }
    }
}

/**
 * 
 * @param {string} url - Direct Download URL
 * @param {string} path - Temp Download Directory ex: /path/to/file.zip
 */
function Download(url, path, options) {
    let received_bytes = 0;
    let total_bytes = 0;

    var req = request(
        {
            method: 'GET',
            uri: url
        }
    );

    var out = fs.createWriteStream(path);
    req.pipe(out);

    req.on('response', data => {
        total_bytes = parseInt(data.headers['content-length']);
    });

    req.on('data', chunk => {
        received_bytes += chunk.length;
        showProgress(received_bytes, total_bytes);
    });

    req.on('end', () => {
        setTimeout(() => Install(options), 2000);
    });
}
/**
 * Unzips the Downloaded Archive to the Application Directory
 * @param {defaultOptions} options
 */
function Install(options) {
    updateHeader("Installing...");
    var AdmZip = require('adm-zip');
    var zip = new AdmZip(`${options.tempDirectory}/${options.appName}.zip`);

    zip.extractAllTo(options.appDirectory, true);
    setTimeout(() => CleanUp(options), 2000);
}

/**
 * Removes any Temp Directories and Files.
 * @param {defaultOptions} options 
 */
function CleanUp(options) {
    updateHeader("Finishing Up...");
    fs.rmdirSync(options.tempDirectory, { recursive: true, maxRetries: 3, retryDelay: 500 })
    setTimeout(() => LaunchApplication(options), 2000);
}

/**
 * Launches the Application
 * @param {defaultOptions} options 
 */
function LaunchApplication(options) {
    let executablePath = `${options.appDirectory}/${options.appExecutableName}`;
    if (fs.existsSync(executablePath)) {
        updateHeader("Launching...");
        let child = require('child_process').execFile;
        child(executablePath, function (err, data) {
            if (err) {
                console.error(err);
                return;
            }
            console.log(data.toString());
        });
    } else {
        console.error(`File Not Found: ${executablePath}`);
        options.forceUpdate = true;
        Update(options);
        return;
    }
    setTimeout(() => {
        try {
            // Electron
            window.close();
        } catch {
            // NodeJS
            process.exit(0);
        }
    }, 2000);
}

//#endregion STAGES


module.exports = { Update, CheckForUpdates };