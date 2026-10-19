"""Optional check: Node.js + native ffmpeg/ffprobe required. Not a WASM browser test."""
import json,subprocess,tempfile,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
args=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {webmArgs} from './src/conversion.js';console.log(JSON.stringify(webmArgs({codec:'vp8',size:1024})));"],cwd=root))
with tempfile.TemporaryDirectory() as work:
 path=Path(work);shutil.copy(root/'tests/fixtures/transparent-600-18s.gif',path/'input.gif')
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error',*args],cwd=path,check=True)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path/'output.webm')]))
 stream=probe['streams'][0];duration=float(probe['format']['duration'])
 assert stream['codec_name']=='vp8' and stream['width']==600 and stream['height']==600
 assert stream['tags']['alpha_mode']=='1' and abs(duration-18.1)<.11
 alpha=subprocess.check_output(['ffmpeg','-v','error','-c:v','libvpx','-i',str(path/'output.webm'),'-frames:v','1','-vf','alphaextract','-f','rawvideo','-pix_fmt','gray','-'])
 assert min(alpha)==0 and max(alpha)==255
 print(json.dumps({'codec':stream['codec_name'],'size':[600,600],'duration':duration,'alpha':[min(alpha),max(alpha)]}))
