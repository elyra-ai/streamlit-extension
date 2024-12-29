#
# Copyright 2017-2023 Elyra Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

import os
import sys
import socket
from subprocess import Popen
from subprocess import CalledProcessError
from subprocess import PIPE
from typing import Dict
from traitlets.config import SingletonConfigurable
from traitlets.config import LoggingConfigurable
from urllib.parse import urlparse


class StreamlitManager(SingletonConfigurable):
    """Class to keep track of streamlit application instances and manage
    lifecycles
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.streamlit_instances = {}

    def list(self) -> Dict:
        return self.streamlit_instances

    def start(self, streamlit_app_filepath: str) -> 'StreamlitApplication':
        if streamlit_app_filepath in self.streamlit_instances.keys():
            return self.streamlit_instances[streamlit_app_filepath]
        streamlit_app = StreamlitApplication(
            streamlit_app_filepath=streamlit_app_filepath)
        streamlit_app.start()
        self.streamlit_instances[streamlit_app_filepath] = streamlit_app
        return streamlit_app

    def stop(self, streamlit_app_filepath: str) -> None:
        streamlit_app = self.streamlit_instances.get(streamlit_app_filepath)
        if streamlit_app:
            streamlit_app.stop()
            del self.streamlit_instances[streamlit_app_filepath]
        else:
            self.log.info(
                "Unable to find running instance of ",
                f"{streamlit_app_filepath} application"
            )

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
            self.log.info(
                "Unable to find running instance of ",
                f"{streamlit_app_filepath} application"
            )


class StreamlitApplication(LoggingConfigurable):
    def __init__(self, streamlit_app_filepath: str, **kwargs):
        """
        :param streamlit_app_filepath: the relative path to the streamlit
        application file (*.py) :param kwargs:
        """
        super().__init__(**kwargs)
        self.internal_host = {}
        self.external_host = {}
        self.port = get_open_port()
        self.app_start_dir = os.path.dirname(streamlit_app_filepath)
        self.app_basename = os.path.basename(streamlit_app_filepath)
        self.streamlit_cmd = [
            sys.executable, "-m", "streamlit", "run", self.app_basename,
            "--browser.gatherUsageStats=false",  # turn off usage stats upload
            "--server.runOnSave=true",  # auto refresh app on save
            "--server.headless=true",  # run headless, avoids email sign up
            "--server.port", self.port
        ]
        self.process = None

    def start(self) -> None:
        if not self.process or not self.is_alive():
            self.log.info(
                f"Starting Streamlit application '{self.app_basename}' ",
                f"on port {self.port}"
            )
            try:
                if self.app_start_dir:
                    self.process = Popen(self.streamlit_cmd,
                                         cwd=self.app_start_dir, stdout=PIPE)
                else:
                    self.process = Popen(self.streamlit_cmd, stdout=PIPE)
            except CalledProcessError as error:
                self.log.info(
                    "Failed to start Streamlit application ",
                    f"on port {self.port} due to {error}"
                )

            # Voodoo magic, needs to 'hit' the process otherwise server will
            # not serve
            for i in range(3):
                self.process.stdout.readline()
            internal_url_line = self.process.stdout.readline().decode('utf-8')
            external_url_line = self.process.stdout.readline().decode('utf-8')
            self.internal_host = parse_hostname(internal_url_line)
            self.external_host = parse_hostname(external_url_line)

    def stop(self) -> None:
        if self.process:
            self.log.info(
                f"Stopping Streamlit application '{self.app_basename}' ",
                f"on port {self.port}"
            )
            self.process.terminate()
            self.process = None
        else:
            self.log.info(
                f"Streamlit application '{self.app_basename}' is not running"
            )

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


def parse_hostname(parse_line: str) -> Dict:
    """
    Fragile function to parse out the URL from the output log
    :param parse_line:
    :return:
    """
    remove_newlines_line = parse_line.rstrip('\n')
    strip_line = remove_newlines_line.strip()
    tokenize_line = strip_line.split(" ")[2]
    url_obj = urlparse(tokenize_line)
    return {
        "host": url_obj.hostname,
        "scheme": url_obj.scheme
    }
