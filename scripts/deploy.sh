#!/usr/bin/env bash

# deploy html to a server and then add html to ipfs

# go to current folder
cd "$(dirname "$0")"

# add env vars
if [ -f ../.deploy-env ]; then
  export $(echo $(cat ../.deploy-env | sed 's/#.*//g'| xargs) | envsubst)
fi

# check creds
if [ -z "${DEPLOY_HOST+xxx}" ]; then echo "DEPLOY_HOST not set" && exit; fi
if [ -z "${DEPLOY_USER+xxx}" ]; then echo "DEPLOY_USER not set" && exit; fi
if [ -z "${DEPLOY_PASSWORD+xxx}" ]; then echo "DEPLOY_PASSWORD not set" && exit; fi

# save version
SEEDIT_VERSION=$(node -e "console.log(require('../package.json').version)")
SEEDIT_HTML_NAME="seedit-html-$SEEDIT_VERSION"
SEEDIT_PREVIOUS_VERSIONS=$(git tag | sed 's/v//g' | tr '\n' ' ')

SCRIPT="
# download html
cd ~
rm $SEEDIT_HTML_NAME.zip
rm -fr $SEEDIT_HTML_NAME
wget https://github.com/bitsocialnet/seedit/releases/download/v$SEEDIT_VERSION/$SEEDIT_HTML_NAME.zip || exit

# extract html
unzip $SEEDIT_HTML_NAME.zip || exit
rm $SEEDIT_HTML_NAME.zip || exit

# add previous versions as folders e.g. /0.1.1
cd $SEEDIT_HTML_NAME
for SEEDIT_PREVIOUS_VERSION in $SEEDIT_PREVIOUS_VERSIONS
do
  # download previous version
  SEEDIT_PREVIOUS_VERSION_HTML_NAME="seedit-html-\$SEEDIT_PREVIOUS_VERSION"
  echo downloading \$SEEDIT_PREVIOUS_VERSION_HTML_NAME...
  wget --quiet https://github.com/bitsocialnet/seedit/releases/download/v\$SEEDIT_PREVIOUS_VERSION/\$SEEDIT_PREVIOUS_VERSION_HTML_NAME.zip
  # extract previous version html
  unzip -qq \$SEEDIT_PREVIOUS_VERSION_HTML_NAME.zip
  rm \$SEEDIT_PREVIOUS_VERSION_HTML_NAME.zip
  mv \$SEEDIT_PREVIOUS_VERSION_HTML_NAME \$SEEDIT_PREVIOUS_VERSION
done
cd ..

# add to ipfs
CID=\`ipfs add --recursive --pin --quieter $SEEDIT_HTML_NAME | tail -n 1\`
ipfs pin add --recursive \"\$CID\"

# start ipfs daemon if not started
ipfs init
nohup ipfs daemon &

# the CID of seedit html, add this CID to ENS
sleep 3
echo \"\"
CID=\`ipfs cid base32 \$CID\`
echo $SEEDIT_HTML_NAME \"CID: \$CID\"
echo \"\"
"

# execute script over ssh
echo "$SCRIPT" | sshpass -p "$DEPLOY_PASSWORD" ssh "$DEPLOY_USER"@"$DEPLOY_HOST"
