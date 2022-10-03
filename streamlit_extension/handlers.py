#
# Copyright 2022 Elyra Authors
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

import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from streamlit_extension.process_manager import StreamlitManager
import tornado


class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head,
    # get, post, patch, put, delete, options) to ensure only authorized user
    # can request the Jupyter server
    @tornado.web.authenticated
    def get(self):
        appList = StreamlitManager.instance().list()
        instances = {}
        for key in appList:
            instances[key] = appList[key].internal_host_url
        self.finish(json.dumps(instances))

    @tornado.web.authenticated
    def post(self):
        # parse filename and location
        json_payload = self.get_json_body()
        streamlit_app_filepath = json_payload['file']

        streamlit_app = StreamlitManager.instance().start(
            streamlit_app_filepath=streamlit_app_filepath
        )

        self.finish(json.dumps({
            "url": f"/proxy/{streamlit_app.port}/"
        }))

    @tornado.web.authenticated
    def delete(self):
        # parse filename and location
        json_payload = self.get_json_body()
        streamlit_app_filepath = json_payload['file']

        StreamlitManager.instance().stop(
            streamlit_app_filepath=streamlit_app_filepath
        )


def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "streamlit", "app")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)
