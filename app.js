'use strict'
const { URL, URLSearchParams } = require('url')
const httpAgent = require('socks5-http-client/lib/Agent')
const httpsAgent = require('socks5-https-client/lib/Agent')
// const config = require('./config')

const node = {
    cheerio: require('cheerio'),
    fs: require('fs'),
    mkdirp: require('mkdirp'),
    path: require('path'),
    request: require('request'),
    rp: require('request-promise'),
    url: require('url'),
    trim: require('locutus/php/strings/trim'),
    strip_tags: require('locutus/php/strings/strip_tags'),
    mapLimit: require('async/mapLimit')
}

const colors = require('colors')
colors.setTheme({
    red: 'red',
    green: 'green',
    blue: 'blue',
    yellow: 'yellow'
})

const lists = [
    {
        type: 'P',
        xcode: '001',
        maxPage: 4
    },
    {
        type: 'P',
        xcode: '014',
        maxPage: 1
    },
    {
        type: 'X',
        xcode: '022',
        maxPage: 6
    },
    {
        type: 'P',
        xcode: '013',
        maxPage: 3
    },
    {
        type: 'X',
        xcode: '003',
        maxPage: 1
    },
    {
        type: 'X',
        xcode: '004',
        maxPage: 6
    },
    {
        type: 'X',
        xcode: '016',
        maxPage: 6
    },
    {
        type: 'X',
        xcode: '006',
        maxPage: 6
    },
    {
        type: 'O',
        xcode: '009',
        maxPage: 2
    }
]

const options = {
    saveTo: './images',
    downLimit: 5,
    start: 0, //0
    hasList: true
}

const getList = async url => {
    console.log('开始下载列表页面：%s'.blue, url)
    return node
        .rp({
            url,
            agentClass: url.indexOf('https://') === 0 ? httpsAgent : httpAgent,
            agentOptions: {
                socksHost: '127.0.0.1',
                socksPort: 2080
            },
            strictSSL: url.indexOf('https://') === 0
        })
        .then(body => {
            console.log('下载列表页面成功：%s'.green, url)
            return {
                url,
                html: body
            }
        })
        .catch(function (err) {
            console.log(err.message)
        })
}

const writeJson = url => {
    const jsonTxt = node.fs.readFileSync('./lists.json', 'utf-8')
    const json = JSON.parse(jsonTxt)
    if (json.indexOf(url) === -1) {
        json.push(url)
        const text = JSON.stringify(json, null, '\t')
        node.fs.writeFileSync('./lists.json', text)
        console.log('写入地址成功：%s'.green, url)
    } else {
        console.log('该地址已经存在：%s'.red, url)
    }
}

const parseList = payload => {
    console.log('开始分析列表页面数据：%s'.blue, payload.url)
    const $ = node.cheerio.load(payload.html)
    const $return = []
    $('.item-list')
        .find('a')
        .each(function () {
            const link = $(this).attr('href')
            const branduid = new URLSearchParams(link.replace('/shop/shopdetail.html', '')).get('branduid')
            if (branduid) {
                writeJson('/shop/shopdetail.html?branduid=' + branduid)
                $return.push('/shop/shopdetail.html?branduid=' + branduid)
            }
        })
}

const makeDir = async item => {
    return new Promise(resolve => {
        const path = node.path
        // const dir = path.join(options.saveTo, item.type + '-' + item.xcode + '-' + item.id)
        const dir = path.join(options.saveTo, item.id)
        console.log('准备创建目录：%s'.blue, dir)
        if (node.fs.existsSync(dir)) {
            console.log('目录：%s 已经存在'.red, dir)
            resolve(item)
        } else {
            node.mkdirp(dir, function () {
                console.log('目录：%s 创建成功'.green, dir)
                resolve(item)
            })
        }
    })
}

const getDetail = async url => {
    console.log('开始下载详情页面：%s'.blue, url)
    return node
        .rp({
            url,
            timeout: 10000,
            agentClass: url.indexOf('https://') === 0 ? httpsAgent : httpAgent,
            agentOptions: {
                socksHost: '127.0.0.1',
                socksPort: 2080
            },
            strictSSL: url.indexOf('https://') === 0
        })
        .then(body => {
            console.log('下载详情页面成功：%s'.green, url)
            return {
                url,
                html: body
            }
        })
        .catch(async function () {
            console.log('抓取页面失败')
            return await getDetail(url)
        })
}

const parseDetail = payload => {
    console.log('开始分析详情页面数据：%s'.blue, payload.url)
    const $ = node.cheerio.load(payload.html)
    const $return = []
    $('.prd-detail')
        .find('img')
        .each(function () {
            const link = $(this).attr('src')
            $return.push(link)
        })
    return $return
}

const downImage = (imgsrc, dir) => {
    return new Promise((resolve, reject) => {
        const url = node.url.parse(imgsrc)
        const fileName = node.path.basename(url.pathname)
        const toPath = node.path.join(options.saveTo, dir, fileName)
        console.log('开始下载图片：%s，保存到：%s'.blue, fileName, dir)
        if (node.fs.existsSync(toPath)) {
            console.log('图片已经存在：%s'.yellow, imgsrc)
            resolve()
        } else {
            node.request
                .get(
                    encodeURI(imgsrc),
                    {
                        timeout: 20000
                    },
                    function (err) {
                        if (err) {
                            console.log('图片下载失败, code = ' + err.code + '：%s'.red, imgsrc)
                            resolve(imgsrc + ' => 0')
                        }
                    }
                )
                .pipe(node.fs.createWriteStream(toPath))
                .on('close', () => {
                    console.log('图片下载成功：%s'.green, imgsrc)
                    const stat = node.fs.statSync(toPath)
                    if (stat.size < 20 * 1024) {
                        node.fs.unlinkSync(toPath)
                        console.log('图片删除成功：图片大小 = %s'.green, stat.size)
                    }
                    resolve()
                })
                .on('error', err => {
                    console.log('图片下载失败：%s'.red, imgsrc)
                    reject(err)
                })
        }
    })
}

const asyncMapLimit = (imgs, id) => {
    return new Promise(resolve => {
        node.mapLimit(
            imgs,
            options.downLimit,
            async function (img) {
                if (
                    img.indexOf('detail.jpg') === -1 &&
                    img.indexOf('modelsize.jpg') === -1 &&
                    img.indexOf('tn-op-line.jpg') === -1 &&
                    img.indexOf('page_20.jpg') === -1
                ) {
                    await downImage(img, id)
                }
                return img
            },
            err => {
                if (err) {
                    console.log(err)
                }
                resolve()
            }
        )
    })
}

const init = async () => {
    if (!options.hasList) {
        const listLength = lists.length
        for (let i = 0; i < listLength; i++) {
            const item = lists[i]
            for (let page = 1; page <= item.maxPage; page++) {
                const url = `http://www.roer.co.kr/shop/shopbrand.html?type=${item.type}&xcode=${item.xcode}&sort=&page=${page}`
                let listHtml
                let retry = 0
                while (!listHtml || retry < 5) {
                    // eslint-disable-next-line max-depth
                    try {
                        listHtml = await getList(url) // 获取列表
                        retry = 5
                    } catch (error) {
                        retry++
                    }
                }
                if (listHtml) parseList(listHtml) // 解析列表代码 取得详情列表
            }
        }
        console.log('所有连接读取完成'.green)
    }
    const jsonTxt = node.fs.readFileSync('./lists.json', 'utf-8')
    const json = JSON.parse(jsonTxt)
    for (let i = options.start; i < json.length; i++) {
        const url = 'http://www.roer.co.kr' + json[i]
        const myURL = new URL(url)
        const params = new URLSearchParams(myURL.search)
        const id = params.get('branduid')
        const xcode = params.get('xcode')
        const type = params.get('type')
        await makeDir({ id, xcode, type })
        let detailHtml
        let retry = 0
        while (!detailHtml || retry < 5) {
            try {
                detailHtml = await getDetail(url)
                retry = 5
            } catch (error) {
                retry++
            }
        }
        const imgArr = await parseDetail(detailHtml)
        const length = imgArr.length
        // let task = []
        // let num = 1
        console.log('开始下载图片, 总数：%s'.blue, length)
        await asyncMapLimit(imgArr, id)
        // for (let j = 0; j < length; j++) {
        //     const img = imgArr[j]
        //     if (img.indexOf('detail.jpg') === -1 && img.indexOf('modelsize.jpg') === -1 && img.indexOf('tn-op-line.jpg') === -1 && img.indexOf('page_20.jpg') === -1) {
        //         console.log(img)
        //         // task.push(downImage(img, type + '-' + xcode + '-' + id))
        //         task.push(downImage(img, id))
        //         if (num % options.downLimit === 0 || num >= length) {
        //             await Promise.all(task)
        //             task = []
        //         }
        //         num++
        //     }
        // }
    }
    console.log('所有图片下载完成'.green)
}

init()
