$(() => {
  $(window).scrollTop($(window).height() / 2);
  $(window).scrollLeft($(window).width() / 2);
  const form = $("#form");
  const fileName = $("#file-name");
  const fileSelect = $("#file-select");
  const progressContainer = $("#progress-container");
  const progressBar = $("#progress-bar");
  const progressBarText = $("#progress-bar-text");
  const spinner =  $("#spinner")
  const check =  $("#check")
  var instanceKey;

  // INIT
  const resetIcons = () => {
    check.css("visibility", "hidden");
    spinner.css("visibility", "hidden");
    $("#js-status").css("display", "block");
  }
  resetIcons();

  //SOCKET IO HELPERS
  const socket = io();
  const url = $(location).attr("href").slice(0, -1);
  $("#debug").text('HELLO');
  $("#debug1").text(url);
  $("#debug2").text(url.substr(url.lastIndexOf("/") + 1));
  socket.emit('start', url.substr(url.slice(0, -1).lastIndexOf("/") + 1));

  socket.on("setAttribute", object => {
    Object.entries(object).forEach(([key, value]) => {
      form.attr(`data-${key}`, value);
    })
  })

  socket.on("trigger", ({topic, payload}) => {
    window.parent.postMessage({
      "type": topic,
      "data": payload
    }, form.data(`target-window`));
  })

  const trackProgress = async () => {
    await socket.on("progress", progress => {
      const percentageCompletion = parseInt(progress.percentage);
      progressBar.css("width", `${parseInt(percentageCompletion)}%`);
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
      progressBar.css("width", `0%`);
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
    const instanceKey = form.data(`instance-key`)
    const targetWindow = form.data(`target-window`)
    axios
      .post(`/upload/${instanceKey}`, data)
      .then(res => {
        socket.off("progress");
        spinner.css("visibility", "hidden");
        check.css("visibility", "visible");
        const type = res.revisionId ? "uploadExisting" : "uploadNew";
        window.parent.postMessage({ type, ...res.data }, targetWindow)
      });
  };
});
