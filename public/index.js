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
  const resetIcons = () => {
    check.css("visibility", "hidden")
    spinner.css("visibility", "hidden")
    $("#js-status").css("display", "block")
  }
  resetIcons();

  const test = () => window.parent.postMessage({
    "type": "upload",
    "data": {
      "status": "WELLDONE",
      }
    }, "https://clin-dev-ed.lightning.force.com");
  
    const test2 = () => window.parent.postMessage({
      "type": "upload",
      "data": {
        "status": "WELLDONE",
        }
      }, "https://clin-dev-ed--plmlaw.visualforce.com");

  test();
  test2();
  test();
  test2();

  const socket = io();
  socket.on('authComplete', ()=> {
    window.parent.postMessage({
      "type": "authComplete",
    }, '*')
  })

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

  const uploadFile = async fileData => {
    var data = new FormData();
    data.append("file", fileData);
    await trackProgress();
    axios
      .post(`/upload`, data)
      .then(res => {
        socket.off("progress")
        spinner.css("visibility", "hidden")
        check.css("visibility", "visible")
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
