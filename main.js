const electron = require('electron');
// Module to control application life.
const app = electron.app;
console.log(app.getPath('userData'));
const ipc = electron.ipcMain;
const storage = require('electron-json-storage');
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;
const _ = require('underscore-node');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let wm = new WindowManager();
let playlists = new Playlists();
var plsName = 'vis_playlists';

function createMainWindow () {
  // Create the browser window.
  var small = [300, 150],
      medium = [300, 450],
      large = [900, 450];
    var mainWindow = wm.createWindow('MAIN', {
	    width: large[0],
	    height: large[1],
	    frame: false,
	    minWidth: 300,
	    minHeight: 150
    });

    // and load the index.html of the app.
    mainWindow.loadURL(`file://${__dirname}/index.html`);

    ipc.on('load', (ev, opts) => {
    	console.log('Window loaded');
	  	storage.has(plsName, function(error, hasKey) {
			if (error) throw error;

			if (hasKey) {
				console.log(plsName +' exists');
				storage.get(plsName, function(e, data) {
					if (e) throw e;
					playlists.empty();
					for (var i = 0; i < data.length; i++) {
						playlists.add(new Playlist(data[i].id, data[i].name, data[i].desc, data[i].songs));
					}
					mainWindow.webContents.send('loadPlaylists', playlists.list());
					//console.log(playlists);
				});
			} else {
				console.log('creating '+plsName);
				storage.set(plsName, [], function(e) {
					if (e) throw e;
					mainWindow.webContents.send('loadPlaylists', []);
				});
			}
		});
    });

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    wm.removeMainWindow();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createMainWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (wm.getMainWindow() === null) {
    createMainWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

ipc.on('background', (event, opts) => {
	//console.log(opts);
	event.sender.send('background', 'hello from background');
});
ipc.on('channel', function(event, opts) {
	//console.log(opts);
	wm.getWindow(opts.channel).webContents.send('channel', opts);
});

ipc.on('playlist.create', (ev, opts) => {
	//console.log('playlist.create');
	//console.log(opts);

	playlists.add(new Playlist(opts.id));

	playlists.save();
	wm.getMainWindow().webContents.send('loadPlaylists', playlists.list());
});
ipc.on('addFromArray', (ev, opts) => {
	var pl = playlists.get(opts.playlist);
	//console.log(pl);
	var f = opts.files;
	for (var i = 0; i < f.length; i++) {
		pl.add(f[i]);
	}
	playlists.save();
	wm.getMainWindow().webContents.send('loadSongs', {playlist: opts.playlist, list: playlists.list()});
});
ipc.on('playlist.update', (ev, opts) => {
	var pl = playlists.get(opts.id);
	pl.name = opts.name;
	pl.desc = opts.desc;
	playlists.save();
	wm.getMainWindow().webContents.send('loadPlaylists', playlists.list());
});
ipc.on('song.remove', (ev, opts) => {
	console.log(opts);
	var pl = playlists.get(opts.playlist);
	pl.remove(opts.cname);
	playlists.save();
});

function WindowManager() {
	var windows = [];
	this.createWindow = function(name, opts) {
		windows.push(new Window(name, opts));
		return windows[windows.length - 1].win;
	}
	this.getWindow = function(name) {
		for (var i = 0; i < windows.length; i++) {
			if (windows[i].name == name) return windows[i].win;
		}
		return null;
	}
	this.updateWindow = function(name, opts) {

	}
	this.getMain = function() {
		return windows[0];
	}
	this.getMainWindow = function() {
		return windows[0].win;
	}
	this.removeMainWindow = function() {
		// this would close all sub windows too
		windows = [];
	}
}
function Window(name, opts) {
	this.name = name;
	this.win = new BrowserWindow(opts);
}
function Playlists() {
	this.playlists = [];
	this.add = function(pl) {
		this.playlists.push(pl);
	}
	this.get = function(id) {
		for (var i = 0; i < this.playlists.length; i++) {
			if (this.playlists[i].id == id) {
				return this.playlists[i];
			}
		}
	}
	this.list = function() {
		return this.playlists;
	}
	this.save = function() {
		storage.set(plsName, this.playlists, function(e) {
			if (e) throw e;
		});
	}
	this.empty = function() {
		this.playlists = [];
	}
}
function Playlist(id, name, desc, songs) {
	this.id = id;
	this.name = name || "Unnamed Playlist";
	this.desc = desc || '';
	this.songs = songs || [];
	this.add = function(song) {
		//console.log(song);
		for (var i = 0; i < this.songs.length; i++) {
			if (this.songs[i].path == song.path) return;
		}
		if (song instanceof Song)
			this.songs.push(song);
		else {
			this.songs.push(new Song(song.title, song.name, song.cname, song.artist, song.path, song.duration));
		}
		
	}
	this.remove = function(cname) {
		var t = [];
		for (var i = 0; i < this.songs.length; i++) {
			if (this.songs[i].cname != cname) t.push(this.songs[i]);
		}
		this.songs = t;
	}
}
function Song(title, name, cname, artist, path, duration) {
	this.title = title || '';
	this.name = name || '';
	this.cname = cname || '';
	this.artist = artist || 'unknown artist';
	this.path = path || '';
	this.duration = duration || '';
}
