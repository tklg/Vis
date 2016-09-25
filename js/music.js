console.info('Node:     ' + process.versions.node);
console.info('Chrome:   ' + process.versions.chrome);
console.info('Electron: ' + process.versions.electron);
//require('./vis.js');
var id3 = require('id3js');
var _ = require('underscore-node');
const electron = require('electron');
const remote = electron.remote;
const ipc = electron.ipcRenderer;
const dialog = remote.dialog;
const nonce = require('nonce')();
const window = remote.getCurrentWindow();

(function() {
	var playerProgress = $('.player .progress-bar');
	var playerVolume = $('.player .volume-bar');
	var playerScrubber = $('.player .scrubber');
	var playerTime = $('.player .time-past');
	// load in from json
	var playlist = null; //new Playlist(['./test_cg.mp3','./test_asdf.mp3','./test_bgcnplamp.mp3','./test_us3.mp3','./test_xx.mp3'], "Playlist Name");
	var autoplay = false;
	var scrubberUpdater;
	var track;

	var mm = new MusicManager();

	setTimeout(function(){
		//playlist.render();
		// s, false, playlist
		track = createVis(null, false, null);
	}, 500);

	function toTimeString(time) {
		var h = Math.floor(time / 3600);
		var m = Math.floor(time % 3600 / 60);
		var s = Math.floor(time % 3600 % 60);
		delete time;
		return ((h > 0 ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s);
	}
	$(".windowframe .btn-devtools").on("click", function(e) {
	    window.openDevTools();
	});
	$(".windowframe .btn-min").on("click", function(e) {
	    window.minimize(); 
	});
	$(".windowframe .btn-max").on("click", function(e) {
	    if (!window.isMaximized()) {
	        window.maximize();          
	    } else {
	        window.unmaximize();
	    }
	});
	$(".windowframe .btn-close").on("click", function(e) {
	    window.close();
	});
	$('.windowframe .icon').on('click', function() {
		$('.cornermenu').toggleClass('active');
	});
	$('body .small, body .medium').on('click', function(e) {
		if ($('.cornermenu').is('.active')) {
			$('.cornermenu').removeClass('active');
		}
	});
	$('.controls #playpause').on('click', function(e) {
		if ($(this).is('.disabled')) return;
		if (track.isPlaying) {
			track.pause();
		} else {
			track.play();
		}
	});
	$('.controls #previous').on('click', function(e) {
		if ($(this).is('.disabled')) return;
		playlist.prev();
		track.play(playlist.current());
	});
	$('.controls #next').on('click', function(e) {
		if ($(this).is('.disabled')) return;
		playlist.next();
		track.play(playlist.current());
	});
	$('.controls #loop').on('click', function(e) {
		if ($(this).is('.disabled')) return;
		switch (track.setLoop()) {
			case 'one':
			case 'single':
				track.setLoop('all');
				break;
			case 'all':
				track.setLoop(false);
				break;
			default:
				track.setLoop('single');
				break;
		}
	});
	$('.player #scrubber-input').on('input', function(e) {
		track.mute(true);
		track.seek($(this).val());
		playerTime.text(toTimeString(track.seek()));
		playerProgress.css('width', (track.seek() / track.duration()) * 100 + '%');
	});
	$('.player #scrubber-input').on('change', function(e) {
		track.mute(false);
	});
	$('.player #volume-input').on('input', function(e) {
		track.volume($(this).val());
		playerVolume.css('width', $(this).val() * 100 + '%');
	});
	$(document).on('click', '.track', function(e) {
		if ($(this).is('.active')) {
			return;
		}
		var i = parseInt($(this).attr('id').split('-')[0]);
		playlist.setIndex(i);
		track.play(playlist.current());
	});
	$('#btn-add-music').on('click', function(e) {
		var res = dialog.showOpenDialog({
			properties: ['openFile', 'multiSelections'],
			filters: [
				{name: 'Audio Files', extensions: ['mp3', 'wav', 'webm', 'ogg', 'flac']},
				{name: 'All Files', extensions: ['*']}
			]
		});
		if (res) {
			mm.addFromArray(res);
		}
	});
	$('#btn-add-music-multiple').on('click', function(e) {
		var res = dialog.showOpenDialog({
			properties: ['openDirectory', 'multiSelections'],
			filters: [
				{name: 'Audio Files', extensions: ['mp3', 'wav', 'webm', 'ogg', 'flac']},
				{name: 'All Files', extensions: ['*']}
			]
		});
		if (res) {
			mm.addFromDirectory(res);
		}
	});

	ipc.on('background', (event, opts) => {
		console.log(opts);
	});

	function Playlist(s, t) {
		var sources = [];
		var template = _.template('<li class="track" id="<%= id+\'-\'+cname %>"><span class="name"><%= title %></span><span class="duration"><%= duration %></span></li>');
		this.title = t || null;
		this.duration = null;
		var index = 0;
		var total = 0;
		this.addSource = function(src) {
			if (src instanceof Source) sources.push(src);
			else sources.push(new Source(src, total++));
			return this;
		}
		this.render = function() {
			$('.player').addClass('loading');
			var c = $('#playlist-container');
			var t = 0;
			c.empty();
			for (var i = 0; i < sources.length; i++) {
				c.append(template(sources[i]));
				t += sources[i].durSec;
			}
			$('#playlist-count').text(sources.length + (sources.length == 1 ? ' song' : " songs"));
			$('#playlist-name').text(this.title);
			$('#playlist-duration').text(toTimeString(t));
			this.update();
		}
		this.update = function(c) {
			var c = this.current();
			var n = c.id+'-'+c.cname;
			$('#playlist-container #' + n).addClass('active').siblings().removeClass('active');
		}
		this.next = function() {
			if (index == sources.length - 1)
				index = 0;
			else
				index++;
			this.update();
		}
		this.prev = function() {
			if (index == 0)
				index = sources.length - 1;
			else
				index--;
			this.update();
		}
		this.setIndex = function(ind) {
			if (ind > -1 && ind < sources.length) {
				index = ind;
				this.update();
			}
		}
		this.index = function() {
			return index;
		}
		this.current = function() {
			return sources[index];
		}
		function toTimeString(time) {
			var h = Math.floor(time / 3600);
			var m = Math.floor(time % 3600 / 60);
			var s = Math.floor(time % 3600 % 60);
			delete time;
			return ((h > 0 ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s);
		}

		if (s) {
			for (var i = 0; i < s.length; i++) {
				this.addSource(s[i]);
			}
		}
	}
	function Source(src, num) {
		this.id = num;
		this.src = src.path || null;
		this.duration = toTimeString(src.duration) || null;
		this.durSec = src.duration || null;
		this.title = src.title || null;
		this.cname = src.cname || null;
		this.artist = src.artist || null;
		this.is = function(src) {
			if (src.src.path == this.src) return true;
			else return false;
		}
		this.init = function(callback) {
			/*var _this = this;
			id3({
				file: _this.src,
				type: id3.OPEN_LOCAL
			}, function(err, tags) {
				console.log('id3 loaded');
				_this.title = tags.title ? tags.title : _this.src.substring(_this.src.lastIndexOf('/') + 1);
				_this.cname = _this.title.replace(/[^\w]/g, '');
				_this.artist = tags.artist ? tags.artist : (tags.v2.band ? tags.v2.band : '&nbsp;');
				var th = new Howl({
					src: [_this.src],
					html5: true,
					volume: 0,
					loop: false,
					autoplay: false,
					onload: function() {
						_this.duration = toTimeString(th.duration());
						_this.durSec = th.duration();
						th.unload();
					}
				});
			});*/
		}
		function toTimeString(time) {
			var h = Math.floor(time / 3600);
			var m = Math.floor(time % 3600 / 60);
			var s = Math.floor(time % 3600 % 60);
			delete time;
			return ((h > 0 ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s);
		}
	}
	function createVis(s, autoplay, p) {
		var src = s;
		var scrubberUpdater;
		var playlist = p;
		var vis = new Vis({
			preferredBarWidth: 10,
			sources: (src ? [src.src] : []),
			volume: 0.37,
			loop: 'all', // 'all', 'single', false
			autoplay: autoplay || false,
			//color: 'rgba(255,255,255,.1)',
			color: 'rainbow',
			rainbowOpacity: 0.2,
			onLoad: function() {
				console.log("Loaded audio: " + src.src);
				$('.player').removeClass('loading');
				$('.ctrl-btn').removeClass('disabled');
				$('#audio-name').text(src.title)
								.attr('title', src.title);
				$('#audio-artist').html(src.artist);
				playerProgress.css('width', 0);
			},
			onEnd: function() {
				console.log("audio ended");
				playerProgress.css('width', '100%');
				playerScrubber.val(vis.duration());
				playerTime.text(toTimeString(vis.duration()));
				clearInterval(scrubberUpdater);
				playerProgress.css('width', 0);
			},
			onPlay: function(src) {
				console.log('Starting audio: ' + src.src);
				$('.player').removeClass('loading');
				$('.ctrl-btn').removeClass('disabled');
				$('#audio-name').text(src.title)
								.attr('title', src.title);
				$('#audio-artist').html(src.artist);
				vis.isPlaying = true;
				$('#playpause i').removeClass('mdi-play').addClass('mdi-pause');
				playerScrubber.attr({
					'min': 0,
					'max': vis.duration()
				});
				scrubberUpdater = setInterval(function() {
					playerProgress.css('width', (vis.seek() / vis.duration()) * 100 + '%');
					playerScrubber.val(vis.seek());
					if (playerScrubber.attr('max') == 'NaN') {
						playerScrubber.attr({
							'max': vis.duration()
						});
					}
					playerTime.text(toTimeString(vis.seek()));
				}, 1000);
			},
			onPause: function() {
				console.log('stopping');
				vis.isPlaying = false;
				$('#playpause i').removeClass('mdi-pause').addClass('mdi-play');
				clearInterval(scrubberUpdater);
			}
			//hideIfZero: false,
			//numBars: 10,
			//color: '#ff5722'
		}, src, playlist);
		return vis;
	}
	function Vis(opt, s, p) {
	   	function extend(a, b) {
			for(var key in b)
				if(b.hasOwnProperty(key))
					a[key] = b[key];
				return a;
		}
		var srcItem = s || null;
		var playlist = p || null;
		var opts = {
			preferredBarWidth: 16,
			forcePreferredBarWidth: false,
			barSpacing: 1,
			color: 'rainbow',
			rainbowOpacity: 1,
			element: 'canvas#visCanvas',
			sourceElement: 'audio#visSource',
			height: null,
			headerHeight: 30,
			width: null, // if set, will use, else will use parent width
			numBars: null, // if set, will use, else will calculate from bar width
			hideIfZero: true,
			loop: false,
			autoplay: true,
			volume: 1,
			sources: [],
			consecutiveZeroesLimit: 50,
			onLoad: function() {

			},
			onPlay: function(name) {
				console.log('now playing ' + name);
			},
			onPause: function() {

			},
			onEnd: function() {

			},
			onDragStart: function() {

			},
			onDragEnd: function() {

			},
			onVolumeChange: function() {

			}
		};
		$('#visSource').replaceWith('<audio id="visSource"></audio>');
		if (opt) extend(opts, opt);

		var _this = this;
		var seeking = false;
		var cv = document.querySelector(opts.element);

		var barColors = [];

		var rs = _.debounce(function(e) {
			console.log('resize');
			opts.width = cv.parentElement.clientWidth;
			opts.height = cv.parentElement.clientHeight;
			cv.setAttribute('height', opts.height);
			cv.setAttribute('width', opts.width);
			numBars = (opts.numBars ? opts.numBars : Math.floor(opts.width / (opts.preferredBarWidth + opts.barSpacing)));
			barWidth = opts.width / numBars - opts.barSpacing;
			if (opts.forcePreferredWidth) {
				barWidth = opts.preferredBarWidth;
			}
			if (barWidth < 4) barWidth = 4;
			for (var i = 0; i < numBars; i++) {
				var frequency = 5 / numBars;
				if (opts.color == 'rainbow2') {
					g = Math.floor(Math.sin(frequency * i + 0) * (127) + 128); //actual rainbow
					r = Math.floor(Math.sin(frequency * i + 2) * (127) + 128);
					b = Math.floor(Math.sin(frequency * i + 4) * (127) + 128);
					barColors[i] = 'rgba('+r+','+g+','+b+','+opts.rainbowOpacity+')';
				} else if (opts.color == 'rainbow') {
					b = Math.floor(Math.sin(frequency * i + 0) * (127) + 128);
					g = Math.floor(Math.sin(frequency * i + 1) * (127) + 128);
					r = Math.floor(Math.sin(frequency * i + 3) * (127) + 128);
					barColors[i] = 'rgba('+r+','+g+','+b+','+opts.rainbowOpacity+')';
				} else if (opts.color == 'random') {
					barColors[i] = '#' + Math.floor(Math.random() * 16777215).toString(16);
				} else {
					barColors[i] = opts.color;
				}
			}
		}, 100);
		$(window).resize(rs);
			
		rs();
		
		var c = cv.getContext('2d');

		var cInd = 0;
		var ind = 0;
		for (var i = 0; i < cv.getAttribute('width'); i += (barWidth + opts.barSpacing)) {
			c.save();
			c.fillStyle = barColors[cInd++];
			c.translate(i, 0);
			c.fillRect(0, (opts.height - opts.height * Math.random())/* + opts.headerHeight*/, barWidth, opts.height);
			c.restore();
			ind += Math.floor(usableLength / numBars);
		}

					
		var ctx = new AudioContext();
		var audio = document.querySelector(opts.sourceElement);

		audio.src = opts.sources[0];

		var audioSrc = ctx.createMediaElementSource(audio);
		var analyser = ctx.createAnalyser();
		audioSrc.connect(analyser);
		analyser.connect(ctx.destination);

		var frequencyData = new Uint8Array(analyser.frequencyBinCount);
		var usableLength = 250;
		var consZ = 0;
		var consZLim = opts.consecutiveZeroesLimit || 50;

		function setUsableLength(len) {
			if (len < usableLength) return;
			usableLength = len;
		}
		function renderFrame() {
			requestAnimationFrame(renderFrame);
			analyser.getByteFrequencyData(frequencyData);

			for (var i = 0; i < frequencyData.length; i++) {
				if (frequencyData[i] == 0) {
					consZ++;
				} else {
					consZ = 0;
				}
				if (consZ >= consZLim) {
					setUsableLength(i - consZLim + 1);
					break;
				}
			}
			c.clearRect(0, 0, opts.width, opts.height);
			var ind = 0;
			var cInd = 0;
			for (var i = 0; i < cv.getAttribute('width'); i += (barWidth + opts.barSpacing)) {
				c.save();
				c.fillStyle = barColors[cInd++];
				c.translate(i, 0);
				if (!opts.hideIfZero)
					c.fillRect(0, opts.height - opts.height * (frequencyData[Math.floor(ind)] / 255) - 1, barWidth, opts.height);
				else 
					c.fillRect(0, opts.height - opts.height * (frequencyData[Math.floor(ind)] / 255), barWidth, opts.height);

				c.restore();
				ind += Math.floor(usableLength / numBars);
			}
			if (audio.ended) {
				opts.onEnd();
				_this.next();
			}
		}

		audio.volume = opts.volume;
		this.loop = opts.loop;

		renderFrame(this);

		this.setPlaylist = function(list) {
			playlist = list;
			srcItem = playlist.current();
		}
		this.setSource = function(src) {
			srcItem = src;
		}
		this.play = function(newSource) {
			if (newSource) {
				audio.src = newSource.src;
				srcItem = newSource;
			}
			this.seek(0);
			audio.play();
			opts.onPlay(newSource ? newSource : srcItem);
			return this;
		}
		this.pause = function() {
			opts.onPause();
			audio.pause();
			return this;
		}
		this.volume = function(vol) {
			if (vol) {
				audio.volume = vol;
				return this;
			} else {
				return audio.volume;
			}
		}
		this.setLoop = function(loop) {
			if (loop != null) {
				this.loop = loop;
				return this;
			} else {
				return this.loop;
			}
		}
		this.mute = function(muted) {
			if (muted != null) {
				audio.muted = muted;
				return this;
			} else {
				return this.muted;
			}
		}
		this.duration = function() {
			return audio.duration;
		}
		this.seek = function(seconds) {
			if (seconds != null) {
				audio.currentTime = seconds;
				return this;
			} else {
				return audio.currentTime;
			}
		}
		this.next = function() {
			if (this.loop == 'single') {
				console.log("repeating song");
				this.play(playlist.current());
			} else if (this.loop == 'all') {
				console.log("next song");
				playlist.next();
				this.play(playlist.current());
			} else {
				console.log('ending song');
			}
		}
		this.prev = function() {
			playlist.prev();
			this.play(playlist.current());
		}

		// loads instantly, usually
		setTimeout(function() {
			opts.onLoad();
			if (opts.autoplay) {
				_this.play();
			}
		}, 40);
	};
	function MusicManager() {
		var hovering;
		var files;
		var playlists = [];
		var songList = $('#song-list');
		var currentPlaylistId = null;
		var playlistTemplate = _.template('<li class="pl-item" nonce="<%= id %>"> <div class="li-v"> <span class="top"><span class="name"><%= name %></span><span class="count"><% (songs.length ? songs.length + " songs" : "") %> </span></span> <span class="bottom desc"><%= desc %></span> </div> <div class="btnbox"> <button class="btn play playlist-play" id="pl-play" nonce="<%= id %>" title="Play this playlist"><i class="mdi mdi-play"></i></button><button class="btn edit playlist-edit" id="pl-edit" nonce="<%= id %>" title="Edit this playlist"><i class="mdi mdi-pencil"></i></button><button class="btn delete playlist-delete" id="pl-delete" nonce="<%= id %>" title="Remove this playlist"><i class="mdi mdi-delete"></i></button> </div> </li>');
		var songTemplate = _.template('<li class="pl-item" cname="<%= cname %>"> <div class="li-v"> <span class="top"><span class="name"><%= name %></span><span class="count"><%= duration %></span></span> <span class="bottom desc"><span class="loc"><%= path %></span></span> </div> <div class="btnbox"> <button class="btn play song-play" id="song-play" title="Play this song" cname="<%= cname %>"><i class="mdi mdi-play"></i></button><button class="btn delete song-delete" id="song-delete" title="Remove this song" cname="<%= cname %>"><i class="mdi mdi-delete"></i></button> </div> </li>');
		var tempSongTemplate = _.template('<li class="pl-item audio-temp-item" cname="<%= cname %>"> <div class="li-v"> <span class="top"><span class="name"><%= title %></span></span> <span class="bottom desc"><span class="loc"><%= path %></span></span> </div> <div class="btnbox"> <button class="btn delete pending-delete" id="song-delete-<%= cname %>" cname="<%= cname %>" title="Remove this song"><i class="mdi mdi-delete"></i></button> </div> </li>');
		this.init = function() {
			console.log("MusicManager.init");
			$('#btn-to-pl').on('click', function(e) {
				$('#pl-list').addClass('active').siblings().removeClass('active');
			})
			$('#pl-editor').on('dragover dragenter', function(e) {
	            e.preventDefault();
	            //e.stopPropagation();
	            if (!hovering) {
	            	console.log('dragover');
	                hovering = true;
	                $('#pl-editor').addClass('hovering');
	            }
	        });
	        $('#pl-editor').on('dragleave dragend', function(e) {
	            e.preventDefault();
	            //e.stopPropagation();
	            hovering = false;
	            $('#pl-editor').removeClass('hovering');
	        });
	        $('#pl-editor').on('drop', function(e) {
	            e.preventDefault();
	            //e.stopPropagation();
	            e = e.originalEvent;
	            hovering = false;
	            fileDragDrop(e, this);
	            $('#pl-editor').removeClass('hovering');
	        });
	        $('#btn-confirm-add-files').on('click', function(e) {
	        	e.stopPropagation();
	        	mm.addFromArray(files);
	        	files = null;
	        	$('#msg-save').removeClass('active');
	        });
	        $('#btn-cancel-add-files').on('click', function(e) {
	        	e.stopPropagation();
	        	files = null;
	        	$('#msg-save').removeClass('active');
	        	$('.pl-temp-item').remove();
	        });
	        $(document).on('click', '#playlist-list .pl-item', function(e) {
	        	e.stopPropagation();
	        	mm.loadPlaylist($(this).attr('nonce'));
	        });
	        $(document).on('click', '.audio-temp-item .pending-delete', function(e) {
	        	e.stopPropagation();
	        	mm.removeFromPending($(this).attr('cname'));
	        });
	        $(document).on('click', '.playlist-play', function(e) {
	        	e.stopPropagation();
	        	var nonce = $(this).parents('.pl-item').attr('nonce');
	        	mm.playPlaylist(nonce);
	        });
	        $(document).on('click', '.playlist-delete', function(e) {
	        	e.stopPropagation();
	        	var nonce = $(this).parents('.pl-item').attr('nonce');
	        	mm.removePlaylist(nonce);
	        });
	        $(document).on('click', '.song-play', function(e) {
	        	e.stopPropagation();
	        	var nonce = $(this).parents('#pl-editor').attr('nonce');
	        	var cname = $(this).attr('cname');
	        	mm.playSingle(nonce, cname);
	        });
	        $(document).on('click', '.song-delete', function(e) {
	        	e.stopPropagation();
	        	var nonce = $(this).parents('#pl-editor').attr('nonce');
	        	var cname = $(this).attr('cname');
	        	mm.removeSong(nonce, cname);
	        });
	        $('#btn-new-playlist').on('click', function(e) {
	        	e.stopPropagation();
	        	$('#pl-editor').addClass('active').siblings().removeClass('active');
	        	$('#song-list').empty();
	        	$('#input-playlist-name').val('');
	        	$('#input-playlist-desc').val('');
	        	var id = nonce();
	        	$('#pl-editor').attr('nonce', id);
	        	currentPlaylistId = id;
	        	ipc.send('playlist.create', {
	        		id: id
	        	});
	        });
	        $('#input-playlist-name, #input-playlist-desc').on('blur', function(e) {
	        	ipc.send('playlist.update', {
	        		id: currentPlaylistId,
	        		name: $('#input-playlist-name').val(),
	        		desc: $('#input-playlist-desc').val()
	        	});
	        })
	        ipc.on('loadPlaylists', (ev, opts) => {
	        	$('#playlist-list').empty();
	        	if (!opts.length) {
	        		$('#playlist-list').append("Add a playlist to get started.");
	        	}
	        	playlists = [];
	        	for (var i = 0; i < opts.length; i++) {
	        		playlists.push(new PlaylistFile(opts[i].id, opts[i].name, opts[i].desc, opts[i].songs));
	        		$('#playlist-list').append(playlistTemplate(opts[i]));
	        	}
	        });
	        ipc.on('loadSongs', (ev, opts) => {
	        	$('#playlist-list').empty();
	        	var list = opts.list;
	        	if (!list.length) {
	        		$('#playlist-list').append("Add a playlist to get started.");
	        	}
	        	playlists = [];
	        	for (var i = 0; i < list.length; i++) {
	        		playlists.push(new PlaylistFile(list[i].id, list[i].name, list[i].desc, list[i].songs));
	        		$('#playlist-list').append(playlistTemplate(list[i]));
	        	}
	        	mm.loadPlaylist(opts.playlist);
	        });
	        ipc.send('load', {
				message: "Hello from music.js"
			});
		}();
		function fileDragDrop(e, elem) {
			e.preventDefault();
	        e.stopPropagation();
            var items = e.dataTransfer.items;
            files = [];
            for (var i = 0; i < items.length; i++) {
                if (items[i].webkitGetAsEntry) {
                    var item = items[i].webkitGetAsEntry();
                    if (item) {
                        traverseFileTree(item, files);
                    }
                }
            }
		}
		function traverseFileTree(item, files) {
			if (item.isFile) {
	            item.file(function(file) {
	                if (/\.(?:wav|mp3|ogg|webm|flac)$/i.test(file.name)) {
	                    /*var t = file.name;
	                    file.cname = file.name.replace(/[^\w]/g, '');
	                    file.title = (t.indexOf('.') > -1) ? t.substr(0, t.lastIndexOf('.')) : t;*/
	                    id3({
							file: file.path,
							type: id3.OPEN_LOCAL
						}, function(err, tags) {
							console.log('id3 loaded');
							file.title = tags.title ? tags.title : ((file.name.indexOf('.') > -1) ? file.name.substr(0, file.name.lastIndexOf('.')) : file.name);
							file.cname = file.title.replace(/[^\w]/g, '');
							file.artist = tags.artist ? tags.artist : (tags.v2.band ? tags.v2.band : '&nbsp;');
							var th = new Howl({
								src: [file.path],
								html5: true,
								volume: 0,
								loop: false,
								autoplay: false,
								onload: function() {
									file.duration = th.duration();
									th.unload();
				                    files.push(file);
				                    songList.append(tempSongTemplate(file));
				                    if (files.length) {
										$("#msg-save").addClass('active');
				                    }
								}
							});
						});
	                }
	            });
	        } else if (item.isDirectory) {
	            var dirReader = item.createReader();
	            var readEntries= function() {
	                dirReader.readEntries(function(entries) {
	                    for (i = 0; i < entries.length; i++) {
	                        traverseFileTree(entries[i], files);
	                    }
	                    if (!entries.length) {
	                        //done
	                    } else {
	                        readEntries();
	                    }
	                });
	            }
	            readEntries();
	        }
		}
		this.removeFromPending = function(cname) {
			for (var i = 0; i < files.length; i++) {
				if (files[i].cname == cname) {
					files = _.without(files, files[i]);
					$('.pl-temp-item[cname='+cname+']').remove();
				}
			}
		}
		this.addFromArray = function(arr) {
			var a = [];
			for (var i = 0; i < arr.length; i++) {
				this.removeFromPending(arr[i].cname);
				a.push({
					name: arr[i].name,
					title: arr[i].title,
					path: arr[i].path,
					cname: arr[i].cname,
					artist: arr[i].artist,
					duration: arr[i].duration
				});
			}
			ipc.send('addFromArray', {
				playlist: $('#pl-editor').attr('nonce'),
				files: a
			});
		}
		this.addFromDirectory = function(dir) {
			console.log(dir);
			ipc.send('addFromDirectory', {
				playlist: $('#pl-editor').attr('nonce'),
				directory: dir
			});
		}
		this.confirmAdd = function() {
			console.log('confirm add');
			addFromArray(files);
		}
		this.loadPlaylist = function(nonce) {
			$('#pl-editor').addClass('active').siblings().removeClass('active');
			$('#pl-editor').attr('nonce', nonce);
			var sl = $('#song-list');
			sl.empty();
			currentPlaylistId = nonce;
			for (var i = 0; i < playlists.length; i++) {
				if (playlists[i].id == nonce) {
					var p = playlists[i];
					$('#input-playlist-name').val(p.name);
					$('#input-playlist-desc').val(p.desc);
					for (var j = 0; j < p.songs.length; j++) {
						var s = p.songs[j];
						sl.append(songTemplate({
							name: s.name,
							path: s.path,
							duration: toTimeString(s.duration),
							cname: s.cname,
							artist: s.artist,
							title: s.title,
							durSec: s.duration
						}));
					}
					break;
				}
			}
		}
		this.removeSong = function(id, cname) {
			for (var i = 0; i < playlists.length; i++) {
				if (playlists[i].id == id) {
					var p = playlists[i];
					p.removeSong(cname);
					ipc.send('song.remove', {playlist: id, cname: cname});
					break;
				}
			}
		}
		this.playSingle = function(id, cname) {
			$('#playlist-name').text('Loading song...');
			for (var i = 0; i < playlists.length; i++) {
				if (playlists[i].id == id) {
					var p = playlists[i];
					for (var j = 0; j < p.songs.length; j++) {
						var song = p.songs[j]
						if (song.cname == cname) {
							playlist = new Playlist([song], song.title);
							//setTimeout(function(){
								playlist.render();
								track.setPlaylist(playlist);
								track.play(playlist.current());
							//}, 500);
							break;
						}
					}
					break;
				}
			}

		}
		this.playPlaylist = function(id) {
			$('#playlist-name').text('Loading playlist...');
			console.log(id);
			for (var i = 0; i < playlists.length; i++) {
				if (playlists[i].id == id) {
					var p = playlists[i];
					playlist = new Playlist(p.songs, p.name);
					//setTimeout(function(){
						playlist.render();
						track.setPlaylist(playlist);
						track.play(playlist.current());
					//}, 500);
					break;
				}
			}
		}
	}
	function PlaylistFile(id, name, desc, songs) {
		this.id = id;
		this.name = name;
		this.desc = desc;
		this.songs = songs;
		this.removeSong = function(cname) {
			$('.pl-item[cname='+cname+']').remove();
			var t = [];
			for (var i = 0; i < this.songs.length; i++) {
				if (this.songs[i].cname != cname) t.push(this.songs[i]);
			}
			this.songs = t;
		}
	}
	function Song(title, name, cname, artist, path, duration) {
		this.title = title;
		this.name = name;
		this.cname = cname;
		this.artist = artist;
		this.path = path;
		this.duration = duration;
		this.durString = toTimeString(duration);
	}
	
})();