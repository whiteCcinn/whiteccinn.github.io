#!/bin/bash

dirname=$(cd "$(dirname "$0")";pwd)
root=$(dirname $dirname)

theme=$(cat ${root}/_config.yml | sed -n '/^theme/p' | awk -F ': ' '{print $2}')
images_dir='_images'
theme_images_dir='images'

find_themes(){
  if [[ -e themes/${theme} ]];then
    return 0
  fi
  return 1
}
 
move_images() {
  cp -vr source/${images_dir}/ themes/${theme}/source/${theme_images_dir}
}
 
find_themes
if [ $? == 0 ];then
  echo '开始迁移图片...'
  move_images
  if [ $? == 0 ];then
    echo '图片迁移完毕...'
  else
    echo '图片迁移失败'
    exit 1
  fi
else
  echo '请先下载主题：git submodule init && git submodule update'
  exit 1
fi

# 处理自定义文件
# file=(
#   source/_languages/*
#   source/avatar.png
#   source/favicon.ico
# )

declare -A path
path['source/_languages/']="themes/${theme}/languages/"
path['source/avatar.png']="themes/${theme}/source/"
path['source/favicon.ico']="themes/${theme}/source/"

for key in ${!path[@]};do
  if [[ -d ${key} ]];then
    for i in $(ls ${key});do
      cp -vf ${key}${i} ${path[${key}]}
    done
  else 
    cp -vf ${key} ${path[${key}]}
  fi
done

rm -f $root/themes/${theme}/_config.yaml
ln -s $root/source/_data/"$theme.yml" $root/themes/${theme}/_config.yaml

echo "处理完毕"
exit 0
