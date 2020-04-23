$(() => {
  $(window).scrollTop($(window).height() / 2);
  $(window).scrollLeft($(window).width() / 2);
  const fileName = $("#file-name");
  const fileSelect = $("#file-select");
  const dropzone = $("#dropzone");
  const progressContainer = $("#progress-container");
  const progressBar = $("#progress-bar");
  const progressBarText = $("#progress-bar-text");
  const spinner =  $("#spinner")
  const check =  $("#check")
  const jsStatus =  $("#js-status")
  const resetIcons = () => {
    check.css("visibility", "hidden")
    spinner.css("visibility", "hidden")
  }
  resetIcons();

  const socket = io();
  socket.on('authComplete', ()=> {
    window.parent.postMessage({
      "type": "authComplete",
    }, '*')
  })

  socket.on('progress', progress => {
    const percentageCompletion = parseInt(progress.percentage);
    progressBar.css('width', `${parseInt(percentageCompletion)}%`);
    progressBarText.text(`${percentageCompletion}%`);
    if (percentageCompletion === 100) {
      jsStatus.css("display", "none")
      spinner.css("visibility", "block")
    }
  });

  [
    "drag",
    "dragstart",
    "dragend",
    "dragover",
    "dragenter",
    "dragleave",
    "drop"
  ].forEach(function (event) {
    dropzone.on(event, function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  fileSelect.on("change", function (e) {
    e.preventDefault();
    resetIcons();
    const file = fileSelect.prop("files")[0];
    if (file) {
      progressBar.css('width', `0%`);
      progressBarText.text(`0%`);
      fileName.text(file.name);
      progressContainer.css("visibility", "visible")
      uploadFile(file);
    } else {
      fileName.text("");
      progressContainer.css("visibility", "hidden")
    }
  });

  const uploadFile = fileData => {
    var data = new FormData();
    data.append("file", fileData);
    axios
      .post(`/upload`, data)
      .then(res => {
        jsStatus.css("display", "block")
        spinner.css("visibility", "hidden")
        check.css("visibility", "block")
        window.parent.postMessage({
          "type": "upload",
          "data": {
            "status": res.status,
            "sfId": res.data.sfId
          }
        }, '*')
      })
  };
});
