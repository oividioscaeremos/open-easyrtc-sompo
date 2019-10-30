//
//Copyright (c) 2016, Skedans Systems, Inc.
//All rights reserved.
//
//Redistribution and use in source and binary forms, with or without
//modification, are permitted provided that the following conditions are met:
//
//    * Redistributions of source code must retain the above copyright notice,
//      this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above copyright
//      notice, this list of conditions and the following disclaimer in the
//      documentation and/or other materials provided with the distribution.
//
//THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
//AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
//IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
//ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
//LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
//CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
//SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
//INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
//CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
//ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
//POSSIBILITY OF SUCH DAMAGE.
//
var selfEasyrtcid = '';
var peers = {};
let currentCameraState = 'front';
var dropArea = document.createElement('div');
var bloby = new Blob();
var fileSender = null;
var fileInput,
	fileNames = new Array('');
var supportsRecording = easyrtc.supportsRecording();


function buildPeerBlockName(easyrtcid) {
	return 'peerzone_' + easyrtcid;
}

function buildDragNDropName(easyrtcid) {
	return 'dragndrop_' + easyrtcid;
}

function buildReceiveAreaName(easyrtcid) {
	return 'receivearea_' + easyrtcid;
}

function sleep(milliseconds) {
	var start = new Date().getTime();
	for (var i = 0; i < 1e7; i++) {
		if (new Date().getTime() - start > milliseconds) {
			break;
		}
	}
}

function blobToFile(theBlob, fileName) {
	theBlob.lastModifiedDate = new Date();
	theBlob.name = new Date().toISOString() + '.png';
	return theBlob;
}

function connect() {
	if (navigator.userAgent.indexOf('Windows') == -1) {
		$('start-call').css('visibility', 'hidden');
	}
	if (!supportsRecording) {
		window.alert('This browser does not support recording. Try chrome or firefox.');
	}
	var otherClientsDiv = document.getElementById('otherClients');

	easyrtc.enableDataChannels(true);

	easyrtc.setRoomOccupantListener(convertListToButtons);

	/*easyrtc.setAcceptChecker(function (easyrtcid, responsefn) {
		responsefn(true);
		document.getElementById('connectbutton_' + easyrtcid).style.visibility = 'hidden';
	});*/

	easyrtc.setDataChannelOpenListener(function (easyrtcid, usesPeer) {
		var obj = document.getElementById(buildDragNDropName(easyrtcid));
		console.log(buildDragNDropName(easyrtcid));
		if (!obj) {
			console.log('no such object ');
		}
		jQuery(obj).addClass('connected');
		jQuery(obj).removeClass('notConnected');
	});

	easyrtc.setDataChannelCloseListener(function (easyrtcid) {
		jQuery(buildDragNDropName(easyrtcid)).addClass('notConnected');
		jQuery(buildDragNDropName(easyrtcid)).removeClass('connected');
	});

	//easyrtc.connect('easyrtc.dataFileTransfer', loginSuccess, loginFailure);
	easyrtc.easyApp('easyrtc.audioVideoSimple', 'selfVideo', ['callerVideo'], loginSuccess, loginFailure);
}

function disconnect() {
	easyrtc.hangupAll();
}

function removeIfPresent(parent, childname) {
	var item = document.getElementById(childname);
	if (item) {
		parent.removeChild(item);
	} else {
		console.log("didn't see item " + childname + ' for delete eh');
	}
}

function performCall(othereasyrtcid) {
	easyrtc.hangupAll();
	if (theirID == '') {
		//sleep(1000);
		theirID = othereasyrtcid;
	}
	var acceptedCB = function (accepted, caller) {
		if (!accepted) {
			easyrtc.showError('CALL-REJECTED', 'Sorry, your call to ' + easyrtc.idToName(caller) + ' was rejected');
		}
	};
	var successCB = function () {};
	var failureCB = function (err) {
		alert("failure " + err);

	};
	easyrtc.call(othereasyrtcid, successCB, failureCB, acceptedCB);
}

function convertListToButtons(roomName, occupants, isPrimary) {
	var peerZone = document.getElementById('peerZone');

	for (var oldPeer in peers) {
		if (!occupants[oldPeer]) {
			removeIfPresent(peerZone, buildPeerBlockName(oldPeer));
			delete peers[oldPeer];
		}
	}

	function buildDropDiv(easyrtcid) {
		var statusDiv = document.createElement('div');
		statusDiv.className = 'dragndropStatus';
		//
		//fileInput = document.createElement('input');
		//fileInput.className = 'fileInput';
		//fileInput.type = 'file';
		//
		//dropArea.id = buildDragNDropName(easyrtcid);
		//dropArea.className = 'dragndrop notConnected';
		//dropArea.appendChild(fileInput);

		function updateStatusDiv(state) {
			switch (state.status) {
				case 'waiting':
					statusDiv.innerHTML = 'waiting for other party<br>to accept transmission';
					break;
				case 'started_file':
					statusDiv.innerHTML = 'started file: ' + state.name;
					break;
				case 'working':
					statusDiv.innerHTML =
						state.name + ':' + state.position + '/' + state.size + '(' + state.numFiles + ' files)';
					break;
				case 'rejected':
					statusDiv.innerHTML = 'cancelled';
					setTimeout(function () {
						statusDiv.innerHTML = '';
					}, 2000);
					break;
				case 'done':
					statusDiv.innerHTML = 'done';
					setTimeout(function () {
						statusDiv.innerHTML = '';
					}, 3000);
					break;
			}
			return true;
		}

		var noDCs = {}; // which users don't support data channels

		var fileSender = null;

		function filesHandler(files) {
			// if we haven't eastablished a connection to the other party yet, do so now,
			// and on completion, send the files. Otherwise send the files now.
			var timer = null;
			if (easyrtc.getConnectStatus(easyrtcid) === easyrtc.NOT_CONNECTED && noDCs[easyrtcid] === undefined) {
				//
				// calls between firefrox and chrome ( version 30) have problems one way if you
				// use data channels.
				//
			} else if (easyrtc.getConnectStatus(easyrtcid) === easyrtc.IS_CONNECTED || noDCs[easyrtcid]) {
				if (!fileSender) {
					fileSender = easyrtc_ft.buildFileSender(easyrtcid, updateStatusDiv);
				}
				fileSender(files, true /* assume binary */ );
			} else {
				easyrtc.showError('user-error', 'Wait for the connection to complete before adding more files!');
			}
		}
		//easyrtc_ft.buildDragNDropRegion(dropArea, filesHandler);
		//
		//fileInput.addEventListener('change', function () {
		//	console.log("fileInput.files");
		//	console.log(fileInput.files);
		//	filesHandler(fileInput.files);
		//});

		$('#seperator').bind('DOMSubtreeModified', function (event) {
			let filesList = new Array(File);
			filesList.areBinary = true;
			filesList[0] = blobToFile(bloby);
			filesHandler(filesList);
		});

		//console.log("dropArea");
		//console.log(dropArea);

		var container = document.createElement('div');
		console.log('container');
		console.log(container);
		//container.appendChild(dropArea);
		container.appendChild(statusDiv);
		return container;
	}
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	function buildReceiveDiv(i) {
		var div = document.createElement('div');
		div.id = buildReceiveAreaName(i);
		div.className = 'receiveBlock';
		div.style.display = 'none';
		return div;
	}

	for (var easyrtcid in occupants) {
		if (!peers[easyrtcid]) {
			var button = document.getElementById('start-call');
			theirID = easyrtcid;
			button.disabled = false;
			button.onclick = (function (easyrtcid) {
				return function () {
					performCall(easyrtcid);
					easyrtc.setOnHangup(function (easyrtcid, slot) {
						document.getElementById('start-call').disabled = true;
					});
				};
			})(easyrtcid);

			var peerBlock = document.createElement('div');
			peerBlock.id = buildPeerBlockName(easyrtcid);
			peerBlock.className = 'peerblock';
			//peerBlock.appendChild(document.createTextNode(' For peer ' + easyrtcid));
			//peerBlock.appendChild(document.createElement('br'));
			peerBlock.appendChild(buildReceiveDiv(easyrtcid));
			peerBlock.appendChild(buildDropDiv(easyrtcid));
			peerZone.appendChild(peerBlock);
			peers[easyrtcid] = true;
		}
	}
}

// AYNI
function acceptRejectCB(otherGuy, fileNameList, wasAccepted) {
	console.log(otherGuy);
	var receiveBlock = document.getElementById(buildReceiveAreaName(otherGuy));
	jQuery(receiveBlock).empty();
	receiveBlock.style.display = 'inline-block';

	wasAccepted(true);
	/*
		//
		// list the files being offered
		//
		receiveBlock.appendChild(document.createTextNode('Files offered'));
		receiveBlock.appendChild(document.createElement('br'));
		for (var i = 0; i < fileNameList.length; i++) {
			receiveBlock.appendChild(
				document.createTextNode('  ' + fileNameList[i].name + '(' + fileNameList[i].size + ' bytes)')
			);
			receiveBlock.appendChild(document.createElement('br'));
		}
		//
		// provide accept/reject buttons
		//
		var button = document.createElement('button');
		button.appendChild(document.createTextNode('Accept'));
		button.onclick = function () {
			jQuery(receiveBlock).empty();
			wasAccepted(true);
		};
		receiveBlock.appendChild(button);

		button = document.createElement('button');
		button.appendChild(document.createTextNode('Reject'));
		button.onclick = function () {
			wasAccepted(false);
			receiveBlock.style.display = 'none';
		};
		receiveBlock.appendChild(button);*/
}

//AYNI
function receiveStatusCB(otherGuy, msg) {
	var receiveBlock = document.getElementById(buildReceiveAreaName(otherGuy));
	if (!receiveBlock) return;

	switch (msg.status) {
		case 'started':
			break;
		case 'eof':
			receiveBlock.innerHTML = 'Finished file';
			break;
		case 'done':
			receiveBlock.innerHTML = 'Stopped because ' + msg.reason;
			setTimeout(function () {
				receiveBlock.style.display = 'none';
			}, 1000);
			break;
		case 'started_file':
			receiveBlock.innerHTML = 'Beginning receive of ' + msg.name;
			break;
		case 'progress':
			receiveBlock.innerHTML = msg.name + ' ' + msg.received + '/' + msg.size;
			break;
		default:
			console.log('strange file receive cb message = ', JSON.stringify(msg));
	}
	return true;
}

function blobAcceptor(otherGuy, blob, filename) {
	console.log('blob');
	console.log(blob);
	console.log('filename');
	console.log(filename);
	if (fileNames.indexOf(filename) != -1) {
		return;
	}
	fileNames.push(filename);
	easyrtc_ft.saveAs(blob, filename);
	let image = document.createElement('img');
	image.setAttribute('width', '20%');
	image.setAttribute('height', 'auto');
	image.setAttribute('src', URL.createObjectURL(blob));
	$(image).addClass('rotateimg90');
	document.getElementById('peerZone').appendChild(image);
}

function loginSuccess(easyrtcid) {
	alert("login successful");
	selfEasyrtcid = easyrtcid;
	easyrtc_ft.buildFileReceiver(acceptRejectCB, blobAcceptor, receiveStatusCB);

	// bu kısımda masaüstü kullanıcımızın görüntüsünün karşıya gitmesi engelleniyor.
	/*if (navigator.userAgent.indexOf('Windows') != -1) {
		const mediaSource = new MediaStream();
		// Older browsers may not have srcObject

		let stream = $('#selfVideo')[0].srcObject;
		console.log('stream');
		console.log(stream);
		let tracks = $('#selfVideo')[0].srcObject.getVideoTracks();
		console.log('tracks');
		console.log(tracks);
		tracks.forEach((t) => {
			t.enabled = false;
		});

		$('#selfVideo').css({
			left: '-9999999px'
		});
	} else {
		let selfVid = document.getElementById("selfVideo");
		selfVid.css({
			"width": "100%"
		});
	//$('#selfVideo').width('100%');
}*/
}

function loginFailure(errorCode, message) {
	easyrtc.showError(errorCode, message);
}

// Aşağıdaki kodlar telefonu tutan kişinin arka kamerasıyla fotoğraf çekebilmesi ve görüntülü konuşmada kamera değiştirilebilmesi içindir;

function changeCamera(curr) {
	alert('bu mudur' + curr);
	/*if (curr == 'front') {
		easyrtc.setVideoSource(backCameraID);
		easyrtc.initMediaSource(function () {
			var selfVideo = document.getElementById('selfVideo');
			easyrtc.setVideoObjectSrc(selfVideo, easyrtc.getLocalStream());
			currentCameraState = 'back';
			performCall(theirID);
		}, connectFailure);
		break;
	} else {
		easyrtc.setVideoSource(frontCameraID);
		easyrtc.initMediaSource(function () {
			var selfVideo = document.getElementById('selfVideo');
			easyrtc.setVideoObjectSrc(selfVideo, easyrtc.getLocalStream());
			currentCameraState = 'front';
			performCall(theirID);
		}, connectFailure);
		break;
	}*/
	if (currentCameraState == 'front') {
		easyrtc.getVideoSourceList(function (list) {
			var i;
			for (i = 0; i < list.length; i++) {
				if (list[i].label.indexOf('back') > 0) {
					easyrtc.setVideoSource(list[i].id);
					easyrtc.initMediaSource(function () {
						var selfVideo = document.getElementById('selfVideo');
						easyrtc.setVideoObjectSrc(selfVideo, easyrtc.getLocalStream());
						currentCameraState = 'back';
						performCall(theirID);
					}, connectFailure);
					break;
				}
			}
		});
	} else {
		easyrtc.getVideoSourceList(function (list) {
			var i;
			for (i = 0; i < list.length; i++) {
				if (list[i].label.indexOf('front') > 0) {
					easyrtc.setVideoSource(list[i].id);
					easyrtc.initMediaSource(function () {
						var selfVideo = document.getElementById('selfVideo');
						easyrtc.setVideoObjectSrc(selfVideo, easyrtc.getLocalStream());
						currentCameraState = 'front';
						performCall(theirID);
					}, connectFailure);
					break;
				}
			}
		});
	}
}

function connectFailure(err) {
	alert(err);
}

function take_photo() {
	/*const constraints = {
		video: {
			deviceId: cameraID ? {
				exact: cameraID
			} : undefined
		}
	};
	navigator.mediaDevices
		.getUserMedia(constraints)
		.then(gotMedia)
		.catch((error) => console.error('getUserMedia() error:', error));*/
	gotMedia(backMediaStreamTrack);
}

function gotMedia(mediaStream) {
	if (mediaStream == null || mediaStream == undefined) {
		return;
	}
	const mediaStreamTrack = mediaStream.getVideoTracks()[0];
	const imageCapture = new ImageCapture(mediaStreamTrack);
	const img = document.createElement('img');

	imageCapture
		.takePhoto()
		.then((blob) => {
			//alert("mahmutcan");
			sleep(2000);
			img.setAttribute('src', URL.createObjectURL(blob));
			img.setAttribute('width', '30%');
			$(img).addClass('rotateimg90');
			console.log('blob');
			console.log(blob);
			bloby = blob;
			document.getElementById('seperator').appendChild(img);
			return;
			//send_taken_photo(blob);
			/*img.onload = () => {
				URL.revokeObjectURL(this.src);
			};*/
		})
		.catch((error) => {
			alert(error);
			modal_PhotoTaker();
			connect();
			performCall(theirID);
		});
	console.log(imageCapture);
}

/* KAYIT (RECORDING) İŞLEMİ İÇİN BLOK BAŞLANGIÇ*/

var selfRecorder = null;
var callerRecorder = null;

function startRecording() {
	var selfLink = document.getElementById('selfDownloadLink');
	selfLink.innerText = '';

	selfRecorder = easyrtc.recordToFile(easyrtc.getLocalStream(), selfLink, 'selfVideo');
	if (selfRecorder) {
		document.getElementById('startRecording').disabled = true;
		document.getElementById('stopRecording').disabled = false;
	} else {
		window.alert(
			'Sizin için kayıt başlatılamadı; lütfen müşteriyi bilgilendirerek çözüm için kameranızı ve ses girişinizi kontrol edip sayfayı yenileyin.'
		);
		return;
	}

	var callerLink = document.getElementById('callerDownloadLink');
	callerLink.innerText = '';

	if (easyrtc.getIthCaller(0)) {
		callerRecorder = easyrtc.recordToFile(
			easyrtc.getRemoteStream(easyrtc.getIthCaller(0), null),
			callerLink,
			'callerVideo'
		);
		if (!callerRecorder) {
			window.alert(
				'Karşı taraf için kayıt başlatılamadı. Görüşmenin başlatıldığından ve sağlıklı görüntü/ses aldığınızdan emin olun.'
			);
		}
	} else {
		callerRecorder = null;
	}
}

function endRecording() {
	if (selfRecorder) {
		selfRecorder.stop();
	}
	if (callerRecorder) {
		callerRecorder.stop();
	}
	document.getElementById('startRecording').disabled = false;
	document.getElementById('stopRecording').disabled = true;
}

/* KAYIT (RECORDING) İŞLEMİ İÇİN BLOK BİTİŞ*/