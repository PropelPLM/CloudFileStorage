$(() => {
  $(window).scrollTop($(window).height() / 2);
  $(window).scrollLeft($(window).width() / 2);
  const form = $('#form');
  const fileName = $('#file-name');
  const fileSelect = $('#file-select');
  const progressContainer = $('#progress-container');
  const progressBar = $('#progress-bar');
  const progressBarText = $('#progress-bar-text');
  const spinner = $('#spinner');
  const check = $('#check');

  // INIT
  const resetIcons = () => {
    check.css('visibility', 'hidden');
    spinner.css('visibility', 'hidden');
    $('#js-status').css('display', 'block');
  };
  resetIcons();

  const instanceKeyFinder = () => {
    const url = $(location).attr('href').slice(0, -1);
    return url.substr(url.slice(0, -1).lastIndexOf('/') + 1);
  };

  //SOCKET IO HELPERS
  const socket = io();
  socket.emit('start', instanceKeyFinder());

  socket.on('setAttribute', (object) => {
    Object.entries(object).forEach(([key, value]) => {
      form.attr(`data-${key}`, value);
    });
  });

  socket.on('trigger', ({ topic, payload }) => {
    window.parent.postMessage(
      {
        type: topic,
        data: payload,
      },
      form.data(`target-window`)
    );
  });

  const trackProgress = async () => {
    await socket.on('progress', (progress) => {
      const percentageCompletion = parseInt(progress.percentage);
      progressBar.css('width', `${parseInt(percentageCompletion)}%`);
      progressBarText.text(`${percentageCompletion}%`);
      if (percentageCompletion === 100) {
        spinner.css('visibility', 'visible');
      }
    });
  };

  //DOM MANIPULATION JQUERY
  fileSelect.on('click', function (e) {
    if (!form.data(`instance-key`) && !form.data(`target-window`)) {
      axios.get(`/setAttribute/${instanceKeyFinder()}`);
    }
  });

  fileSelect.on('change', function (e) {
    e.preventDefault();
    resetIcons();
    const file = fileSelect.prop('files')[0];
    if (file) {
      progressBar.css('width', `0%`);
      progressBarText.text(`0%`);
      fileName.text(file.name);
      progressContainer.css('visibility', 'visible');
      uploadFile(file);
    } else {
      fileName.text('');
      progressContainer.css('visibility', 'hidden');
    }
  });

  const uploadFile = async (fileData) => {
    var data = new FormData();
    data.append('fileData.name', fileData.name);
    data.append('fileData.size', fileData.size);
    data.append('fileData.type', fileData.type);
    data.append('file', fileData);
    await trackProgress();
    const instanceKey = form.data(`instance-key`);
    const targetWindow = form.data(`target-window`);
    const config = {
      onUploadProgress: progress => {
        percentCompleted = Math.round((progress.loaded*100) / progress.total)
        $('#debug').text(percentCompleted)
        $('#debug1').text(progress.total)
      }
    }
    axios.post(`/upload/${instanceKey}`, data, config)
      .then((res) => {
        socket.off('progress');
        spinner.css('visibility', 'hidden');
        check.css('visibility', 'visible');
        const type = res.data.isNew ? 'uploadNew' : 'uploadExisting';
        window.parent.postMessage({ type, ...res.data }, targetWindow);
      });
  };
});
