import os
import sys
import socket
from subprocess import Popen
from subprocess import CalledProcessError
from subprocess import PIPE
from traitlets.config import SingletonConfigurable
from traitlets.config import LoggingConfigurable


class StreamlitManager(SingletonConfigurable):
    """
    Class to keep track of streamlit application instances and manage lifecycles
    """
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.streamlit_instances = {}

    def start(self, streamlit_app_filepath: str) -> str:
        streamlit_app = StreamlitApplication(streamlit_app_filepath=streamlit_app_filepath)
        streamlit_app.start()
        self.streamlit_instances[streamlit_app_filepath] = streamlit_app
        return streamlit_app.port

    def stop(self, streamlit_app_filepath: str) -> None:
        streamlit_app = self.streamlit_instances.get(streamlit_app_filepath)
        if streamlit_app:
            streamlit_app.stop()
        else:
            self.log.info(f"Unable to find running instance of {streamlit_app_filepath} application")

    def restart(self, streamlit_app_filepath: str) -> None:
        """
        Forces a restart of a streamlit application.
        NOTE: does not restart a "stopped" application process
        :param streamlit_app_filepath:
        :return:
        """
        streamlit_app = self.streamlit_instances.get(streamlit_app_filepath)
        if streamlit_app:
            streamlit_app.stop()
            streamlit_app.start()
        else:
            self.log.info(f"Unable to find running instance of {streamlit_app_filepath} application")


class StreamlitApplication(LoggingConfigurable):
    def __init__(self, streamlit_app_filepath: str, **kwargs):
        """
        :param streamlit_app_filepath: the relative path to the streamlit application file (*.py)
        :param kwargs:
        """
        super().__init__(**kwargs)
        self.port = get_open_port()
        self.app_start_dir = os.path.dirname(streamlit_app_filepath)
        self.app_basename = os.path.basename(streamlit_app_filepath)
        self.streamlit_cmd = [sys.executable, "-m", "streamlit", "run", self.app_basename,
                              "--browser.gatherUsageStats=false",  # turn off usage upload to streamlit
                              "--server.runOnSave=true",           # auto refresh app on save
                              "--server.headless=true",            # run headless, avoids email sign up
                              "--server.port", self.port]
        self.process = None

    def start(self) -> None:
        if not self.process or not self.is_alive():
            self.log.info(f"Starting Streamlit application '{self.app_basename}' on port {self.port}")
            try:
                self.process = Popen(self.streamlit_cmd, cwd=self.app_start_dir, stdout=PIPE)
            except CalledProcessError as error:
                self.log.info(f"Failed to start Streamlit application on port {self.port} due to {error}")

            # Voodoo magic, needs to 'hit' the process otherwise server will not serve
            self.process.stdout.readline()

    def stop(self) -> None:
        if self.process:
            self.log.info(f"Stopping Streamlit application '{self.app_basename}' on port {self.port}")
            self.process.terminate()
            self.process = None
        else:
            self.log.info(f"Streamlit application '{self.app_basename}' is not running")

    def is_alive(self) -> bool:
        """
        Check if child process has terminated.
        """
        if self.process:
            return False if self.process.poll() else True
        else:
            return False


def get_open_port() -> str:
    """
    Returns an open port on the application host
    :return:
    """
    sock = socket.socket()
    sock.bind(('', 0))
    return str(sock.getsockname()[1])
