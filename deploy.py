import os
import re
import sys
import json
import shutil
import subprocess
import paramiko

def print_banner(msg):
    print("\n" + "=" * 60)
    print(f" {msg}")
    print("=" * 60)

def bump_version(version, bump_type):
    parts = list(map(int, version.split('.')))
    while len(parts) < 3:
        parts.append(0)
    
    if bump_type == 'major':
        parts[0] += 1
        parts[1] = 0
        parts[2] = 0
    elif bump_type == 'minor':
        parts[1] += 1
        parts[2] = 0
    else:  # patch (default)
        parts[2] += 1
        
    return '.'.join(map(str, parts))

def main():
    # 1. Parse arguments for bump type
    bump_type = 'patch'
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower()
        if arg in ['major', 'minor', 'patch']:
            bump_type = arg
        else:
            print(f"Warning: Unknown bump type '{sys.argv[1]}'. Defaulting to 'patch'.")

    print_banner(f"Starting Deployment Process (Bump Type: {bump_type.upper()})")

    # Paths
    config_path = os.path.join('frontend', 'src', 'config.js')
    gradle_path = os.path.join('frontend', 'android', 'app', 'build.gradle')
    release_json_path = os.path.join('backend', 'uploads', 'releases', 'release.json')

    # 2. Read current version from config.js
    if not os.path.exists(config_path):
        print(f"Error: Config file not found at {config_path}")
        sys.exit(1)
        
    print("Reading current version from config.js...")
    with open(config_path, 'r', encoding='utf-8') as f:
        config_content = f.read()

    version_match = re.search(r"appVersion:\s*['\"]([^'\"]+)['\"]", config_content)
    if not version_match:
        print("Error: Could not parse appVersion from config.js")
        sys.exit(1)
        
    current_version = version_match.group(1)
    new_version = bump_version(current_version, bump_type)
    print(f"Current version: {current_version} -> New version: {new_version}")

    # 3. Read build.gradle and increment versionCode & versionName
    if not os.path.exists(gradle_path):
        print(f"Error: Gradle file not found at {gradle_path}")
        sys.exit(1)

    print("Reading and updating build.gradle...")
    with open(gradle_path, 'r', encoding='utf-8') as f:
        gradle_content = f.read()

    vc_match = re.search(r"versionCode\s+(\d+)", gradle_content)
    if not vc_match:
        print("Error: Could not parse versionCode from build.gradle")
        sys.exit(1)
    current_vc = int(vc_match.group(1))
    new_vc = current_vc + 1
    print(f"Current versionCode: {current_vc} -> New versionCode: {new_vc}")

    # 4. Write updates to local files
    print("Updating config.js...")
    new_config_content = re.sub(r"(appVersion:\s*['\"])[^'\"]+(['\"])", fr"\g<1>{new_version}\g<2>", config_content)
    with open(config_path, 'w', encoding='utf-8') as f:
        f.write(new_config_content)

    print("Updating build.gradle...")
    new_gradle_content = re.sub(r"(versionCode\s+)\d+", fr"\g<1>{new_vc}", gradle_content)
    new_gradle_content = re.sub(r'(versionName\s+["\'])[^"\']+(["\'])', fr"\g<1>{new_version}\g<2>", new_gradle_content)
    with open(gradle_path, 'w', encoding='utf-8') as f:
        f.write(new_gradle_content)

    print("Updating release.json...")
    if os.path.exists(release_json_path):
        with open(release_json_path, 'r', encoding='utf-8') as f:
            release_data = json.load(f)
    else:
        release_data = {"latestVersion": current_version, "downloadUrl": "/api/system/update-page"}
        
    release_data['latestVersion'] = new_version
    with open(release_json_path, 'w', encoding='utf-8') as f:
        json.dump(release_data, f, indent=2)

    # 5. Git Commit and Push
    print_banner("Git Commit & Push")
    try:
        subprocess.run('git add -A', shell=True, check=True)
        commit_msg = f"Build & Deploy v{new_version}"
        subprocess.run(f'git commit -m "{commit_msg}"', shell=True, check=True)
        subprocess.run('git push origin master', shell=True, check=True)
        print("Successfully pushed changes to GitHub.")
    except subprocess.CalledProcessError as e:
        print(f"Git command failed: {e}")
        sys.exit(1)

    # 6. Local Frontend Build & Capacitor Sync
    print_banner("Building Frontend & Syncing Capacitor")
    try:
        print("Building web assets...")
        subprocess.run('npm run build', cwd='frontend', shell=True, check=True)
        print("Syncing web assets to android folder...")
        subprocess.run('npx cap sync', cwd='frontend', shell=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Frontend build or capacitor sync failed: {e}")
        sys.exit(1)

    # 7. Local Android APK Compilation
    print_banner("Compiling Android APK (assembleDebug)")
    try:
        env = os.environ.copy()
        # Set JAVA_HOME specifically to Android Studio's bundled OpenJDK
        env['JAVA_HOME'] = r"C:\Program Files\Android\Android Studio\jbr"
        subprocess.run(r'.\gradlew.bat assembleDebug', cwd=os.path.join('frontend', 'android'), env=env, shell=True, check=True)
        print("Successfully compiled app-debug.apk")
    except subprocess.CalledProcessError as e:
        print(f"Gradle compile failed: {e}")
        sys.exit(1)

    # 8. Copy generated APK to target paths
    print_banner("Copying Compiled APK")
    src_apk = os.path.join('frontend', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
    dest_root = 'OceanSpas-OrderManager.apk'
    dest_backend = os.path.join('backend', 'uploads', 'releases', 'OceanSpas-OrderManager.apk')
    
    try:
        print(f"Copying to root: {dest_root}")
        shutil.copy2(src_apk, dest_root)
        print(f"Copying to backend uploads: {dest_backend}")
        shutil.copy2(src_apk, dest_backend)
    except Exception as e:
        print(f"Copying APK files failed: {e}")
        sys.exit(1)

    # 9. Remote Server Updates
    print_banner("Updating Ubuntu Server & Uploading APK")
    
    server_ip = '116.74.77.22'
    username = 'dckakadia'
    password = 'Devin@404404'
    remote_project_dir = '/home/dckakadia/order_manager'
    
    try:
        # Establish SSH connection
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(server_ip, username=username, password=password)
        
        # Execute remote shell commands
        remote_cmds = [
            f"cd {remote_project_dir} && git restore backend/package-lock.json frontend/package-lock.json",
            f"cd {remote_project_dir} && git pull",
            f"cd {remote_project_dir}/frontend && npm run build",
            "pm2 restart order_manager"
        ]
        
        for cmd in remote_cmds:
            print(f"Executing: {cmd}")
            stdin, stdout, stderr = client.exec_command(cmd)
            exit_status = stdout.channel.recv_exit_status()
            
            out_bytes = stdout.read()
            err_bytes = stderr.read()
            
            if out_bytes:
                sys.stdout.buffer.write(out_bytes)
                sys.stdout.buffer.write(b'\n')
                sys.stdout.flush()
            if err_bytes:
                print("ERROR/WARNING:")
                sys.stdout.buffer.write(err_bytes)
                sys.stdout.buffer.write(b'\n')
                sys.stdout.flush()
                
            if exit_status != 0:
                print(f"Command '{cmd}' failed with status {exit_status}")
                client.close()
                sys.exit(1)
                
        # Upload APK and release.json via SFTP
        print("Opening SFTP connection...")
        sftp = client.open_sftp()
        
        remote_apk_path = f"{remote_project_dir}/backend/uploads/releases/OceanSpas-OrderManager.apk"
        remote_release_path = f"{remote_project_dir}/backend/uploads/releases/release.json"
        
        print(f"Uploading APK to remote: {remote_apk_path} ...")
        sftp.put(dest_backend, remote_apk_path)
        
        print(f"Uploading release.json to remote: {remote_release_path} ...")
        sftp.put(release_json_path, remote_release_path)

        # Upload google-credentials.json via SFTP
        remote_creds_path = f"{remote_project_dir}/backend/google-credentials.json"
        local_creds_path = os.path.join('backend', 'google-credentials.json')
        if os.path.exists(local_creds_path):
            print(f"Uploading google-credentials.json to remote: {remote_creds_path} ...")
            sftp.put(local_creds_path, remote_creds_path)
        
        sftp.close()
        client.close()
        
        print_banner(f"DEPLOYMENT SUCCESSFUL! version: {new_version} (code {new_vc})")
        
    except Exception as e:
        print(f"Remote deployment failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
