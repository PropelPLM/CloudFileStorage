$(() => {
  $(window).scrollTop($(window).height() / 2);
  $(window).scrollLeft($(window).width() / 2);
  const fileName = $("#file-name");
  const fileSelect = $("#file-select");
  const progressContainer = $("#progress-container");
  const progressBar = $("#progress-bar");
  const progressBarText = $("#progress-bar-text");
  const spinner =  $("#spinner")
  const check =  $("#check")
  var targetWindow;

  // INIT
  const resetIcons = () => {
    check.css("visibility", "hidden")
    spinner.css("visibility", "hidden")
    $("#js-status").css("display", "block")
  }
  resetIcons();

  //SOCKET IO HELPERS
  const socket = io();

  // socket.on('targetWindow', (url) => {
  //   console.log('socket io url', url)
  //   targetWindow = url;
  // })

  socket.on('authComplete', ()=> {
    window.parent.postMessage({
      "type": "authComplete",
    }, targetWindow)
  })

  const trackProgress = async () => {
    await socket.on('progress', progress => {
      const percentageCompletion = parseInt(progress.percentage);
      progressBar.css('width', `${parseInt(percentageCompletion)}%`);
      progressBarText.text(`${percentageCompletion}%`);
      if (percentageCompletion === 100) {
        spinner.css("visibility", "visible")
      }
    });
  }

  //DOM MANIPULATION JQUERY
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

  const uploadFile = async fileData => {
    var data = new FormData();
    data.append("file", fileData);
    await trackProgress();
    axios
      .post(`/upload`, data)
      .then(res => {
        socket.off("progress");
        spinner.css("visibility", "hidden");
        check.css("visibility", "visible");
        targetWindow = res.data.salesforceUrl
        const type = res.revisionId ? "uploadExisting" : "uploadNew";
        window.parent.postMessage({ type, ...res.data }, targetWindow)
      });
  };
});
