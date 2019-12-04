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
var supportsRecording;
var touchUpModal = document.getElementById('touchUpModal');
var drawer;

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

function rotate(parameter) {
	if (parameter == 'minus') {
		$('#touchUpCanvasForDrawing').removeClass('rotateimg90');
	} else {
		if ($('#touchUpCanvasForDrawing').attr('class').indexOf('rotateimg90') < 0) {
			$('#touchUpCanvasForDrawing').addClass('rotateimg90');
		}
	}
}

/*SIDEBAR İÇİN FONKSİYONLAR */
function openNav() {
	document.getElementById('mySidenav').style.width = '330px';
	document.getElementById('wholeContent').style.marginLeft = '330px';
	$(drawer).drawr("destroy");
}

function closeNav() {
	document.getElementById('mySidenav').style.width = '0';
	document.getElementById('wholeContent').style.marginLeft = '0';
	$(drawer).drawr("destroy");
}
/*SIDEBAR İÇİN FONKSİYONLAR */

function connect() {

	easyrtc.enableDataChannels(true);

	easyrtc.setRoomOccupantListener(convertListToButtons);

	easyrtc.setDataChannelOpenListener(function (easyrtcid, usesPeer) {
		var obj = document.getElementById(buildDragNDropName(easyrtcid));
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
	easyrtc.easyApp('easyrtc.dataFileTransfer', 'selfVideo', ['callerVideo'], loginSuccess, loginFailure);
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
	theirID = othereasyrtcid;

	var acceptedCB = function (accepted, caller) {
		if (!accepted) {
			easyrtc.showError('CALL-REJECTED', 'Sorry, your call to ' + easyrtc.idToName(caller) + ' was rejected');
		}
	};
	var successCB = function () {};
	var failureCB = function (err) {
		alert('failure ' + err);
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

/*<!--- BU KISIMDA DRAWR'DA OLMAYAN ROTATE METODUNU YAZDIM */

function loadImage(url) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.addEventListener('load', () => resolve(img));
		img.addEventListener('error', reject); // don't forget this one
		img.src = url;
	});
}

function imageRotater(imgData, width, height, degree) {
	if ($("#rotaterImage").hasClass("rotate")) {
		$("#rotaterImage").removeClass("rotate");
	}
	var rotaterCanvas = document.createElement("canvas");
	rotaterCanvas.width = height;
	rotaterCanvas.height = width;
	var rotaterContext = rotaterCanvas.getContext("2d");
	var rotaterImage = new Image();

	rotaterImage.onload = async function loadAndUse() {
		$("#rotaterImage").addClass("rotate");

		const image = await loadImage(imgData);

		rotaterContext.translate(rotaterCanvas.width / 2, rotaterCanvas.height / 2);

		rotaterContext.rotate(degree * Math.PI / 180);

		rotaterContext.drawImage(image, -image.width / 2, -image.height / 2);

		rotaterContext.rotate(-degree * Math.PI / 180);

		rotaterContext.translate(-rotaterCanvas.width / 2, -rotaterCanvas.height / 2);

		var data = rotaterCanvas.toDataURL("image/png");
		$("#rotaterImage").removeClass("rotate");
		return data;

	}
	return rotaterImage.onload().then(function (result) {
		return result;
	});
}

$('#rotater').on('click', function () {
	var newDrawer = document.createElement("canvas");
	newDrawer.width = drawer.height;
	newDrawer.height = drawer.width;
	var ctx = newDrawer.getContext("2d");

	var recentUndoStack = drawer.undoStack;
	$(drawer).drawr("destroy");
	$(newDrawer).attr("id", "touchUpCanvasForDrawing");
	$(newDrawer).addClass("demo-canvas");
	$(newDrawer).addClass("drawr-test1");
	$(drawer).replaceWith(newDrawer);
	drawer = newDrawer;

	var photoToEditNewCanvas = new Image();

	photoToEditNewCanvas.onload = function () {

		var imageDraw = new Image();
		imageDraw.onload = function () {
			$("#drawr-container").css({
				width: this.width,
				height: this.height
			});

			$(newDrawer).drawr({
				enable_tranparency: false,
				canvas_width: this.width,
				canvas_height: this.height,
				undo_max_levels: 100
			});

			ctx.drawImage(this, 0, 0, this.width, this.height);

			$(newDrawer).drawr('start');

			newDrawer.undoStack = [{
				data: newDrawer.toDataURL('image/png'),
				current: true
			}];

			for (var i = 1; i < recentUndoStack.length; i++) {
				var anImage = new Image();

				anImage.onload = function () {
					ctx.drawImage(this, 0, 0, this.width, this.height);
					newDrawer.undoStack.push({
						data: this.src,
						current: true
					});
					return;
				};
				imageRotater(recentUndoStack[i].data, this.height, this.width, 90).then(function (res) {
					anImage.src = res;
				});
			}
		};
		imageRotater(recentUndoStack[0].data, this.width, this.height, 90).then(function (res) {
			imageDraw.src = res;
		});

	};

	photoToEditNewCanvas.src = recentUndoStack[0].data;
});

/*BU KISIMDA DRAWR'DA OLMAYAN ROTATE METODUNU YAZDIM ---!>*/

function touchUpOnPhoto(photoBlob, name) {
	openNav();

	var photoToEdit = new Image();
	drawer = document.getElementById('touchUpCanvasForDrawing');
	var ctx = drawer.getContext('2d');
	photoToEdit.onload = async function () {
		photoToEdit = await loadImage(URL.createObjectURL(photoBlob));

		const scale = $('.modal-body.image').height() * 100 / this.width;
		this.width = $('.modal-body.image').height();
		this.height = this.height * (scale / 100);
		$(drawer).drawr({
			enable_tranparency: false,
			canvas_width: this.width,
			canvas_height: this.height,
			undo_max_levels: 100
		});

		ctx.drawImage(this, 0, 0, this.width, this.height);

		$(drawer).drawr('start');

		drawer.undoStack = [{
			data: drawer.toDataURL('image/png'),
			current: true
		}];

		document.getElementById('mySidenav').style.width = this.width + 80 + 'px';
		document.getElementById('wholeContent').style.marginLeft = this.width + 80 + 'px';
		$('#drawr-container').css({
			width: this.width,
			height: this.height
		});
	};

	$('#saveChanges').on('click', function () {
		// fotoğraf üzerinde değişimler bittikten sonra fotoğrafı kaydedeceğiz.
		console.log(name);
		drawer.toBlob(function (blob) {
			easyrtc_ft.saveAs(blob, name.split('.')[1] + '_CHANGED' + name.split('.')[2]);
		});

		drawer.undoStack = [];

		closeNav();
	});

	photoToEdit.src = URL.createObjectURL(photoBlob);
}

function blobAcceptor(otherGuy, blob, filename) {
	if (fileNames.indexOf(filename) != -1) {
		return;
	}
	fileNames.push(filename);
	//easyrtc_ft.saveAs(blob, filename); // fotoğrafı direkt olarak indirmek için kullanılan satır.
	let image = document.createElement('img');
	image.setAttribute('src', URL.createObjectURL(blob));
	$(image).addClass('rotateimg90');
	image.setAttribute('width', '10%');
	image.setAttribute('height', 'auto');
	image.addEventListener('click', function () {
		touchUpOnPhoto(blob, filename);
	});
	document.getElementById('peerZone').appendChild(image);
}

function loginSuccess(easyrtcid) {
	selfEasyrtcid = easyrtcid;
	easyrtc_ft.buildFileReceiver(acceptRejectCB, blobAcceptor, receiveStatusCB);

	// bu kısımda masaüstü kullanıcımızın görüntüsünün karşıya gitmesi engelleniyor.
	if (navigator.userAgent.indexOf('Windows') != -1 || (navigator.userAgent.indexOf('Mac') != -1 && navigator.userAgent.indexOf('iPhone') == -1)) {
		const mediaSource = new MediaStream();
		alert("selam fıstık");
		let tracks = $('#selfVideo')[0].srcObject.getVideoTracks();
		tracks.forEach((t) => {
			t.enabled = false;
		});

		$('#selfVideo').css({
			left: '-9999999px'
		});
	} else {
		$('#selfVideo').width("80%");
		$('#selfVideo').height("auto");
		$('#selfVideo').css({
			margin: "0 auto",
			display: "block"
		});
		$('#callerVideo').css({
			left: "-99999px",
			position: "absolute"
		});
	}
}

function loginFailure(errorCode, message) {
	easyrtc.showError(errorCode, message);
}

// Aşağıdaki kodlar telefonu tutan kişinin arka kamerasıyla fotoğraf çekebilmesi ve görüntülü konuşmada kamera değiştirilebilmesi içindir;

function changeCamera(curr) {
	let stream = $('#selfVideo')[0].srcObject;
	let tracks = stream.getVideoTracks();
	if (currentCameraState == 'front') {
		tracks.forEach((t) => {
			stream.removeTrack(t);
			stream.addTrack(backMediaStreamTrack);
		});
		easyrtc.renegotiate(theirID);
		currentCameraState = 'back';
	} else {
		tracks.forEach((t) => {
			stream.removeTrack(t);
			stream.addTrack(frontMediaStreamTrack);
		});
		easyrtc.renegotiate(theirID);
		currentCameraState = 'front';
	}
}

function connectFailure(err) {
	alert(err);
}

function take_photo() {
	const constraints = {
		video: {
			deviceId: backCameraID ? {
				exact: backCameraID
			} : undefined
		},
		audio: false
	};
	/*navigator.mediaDevices
		.getUserMedia(constraints)
		.then(gotMedia)
		.catch((error) => console.error('getUserMedia() error:', error));*/
	//gotMedia();
}

function gotMedia() {
	console.log('START-----------------------------------------');
	//const mediaStreamTrack = mediaStream.getVideoTracks()[0];
	//const imageCapture = new ImageCapture(mediaStreamTrack);
	const imageCapture = new ImageCapture(backMediaStreamTrack);
	const img = document.createElement('img');

	imageCapture
		.takePhoto()
		.then((blob) => {
			//alert("mahmutcan");
			sleep(1000);
			img.setAttribute('src', URL.createObjectURL(blob));
			img.setAttribute('width', '30%');
			$(img).addClass('rotateimg90');
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
			console.log(error);
			easyrtc.renegotiate(theirID);
		});
	console.log('END-----------------------------------------');
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