import express, { Request, Response } from 'express'
import cors from 'cors'
import pool from '@database/mysql'
import config from '@config/config'
import multer from 'multer'
import { IUser } from '@interfaces/IUser'
import { RowDataPacket } from 'mysql2'
import BadResponse from './implements/BadResponse'
import ResponseType from './enums/ResponseType'
import ProductsResponse from './implements/ProductsResponse'
import IProduct from './interfaces/IProduct'


export class Main
{
    private static app = express()
    private static ipAddress: string = config.HOST_URL
    private static port: number = config.HOST_PORT
    private static corsOptions =
    {
        origin: '*',
        optionsSuccessStatus: 200 // 对于一些旧版浏览器的兼容处理
    }
    private static upload;

    static {
        const storage = multer.memoryStorage()
        this.upload = multer({ storage: storage })
    }

    public static main(args: string[]): void
    {     
        if (!args.includes('--skip-mysql'))
        {
            pool.getConnection((_, conn) => {
                conn.connect(err => {
                    if (err) {
                        console.error('Error connecting to MySQL:', err.stack);
                        return;
                    }
                    console.log('Connected to MySQL as id', conn.threadId);
                })

                conn.release()
            })
        }

        this.app.use(cors(this.corsOptions), express.json()) // JSON中间件不传就会解析不了Body - 返回undefined // cors解决跨域请求安全政策

        this.app.get('/user/:account', this.handleUserRequest)

        this.app.get('/uid/:uid', this.handleUserFetching)

        this.app.post('/user', this.handleUserRegister)

        this.app.post('/avatar/:account', this.upload.single('file'), this.handleAvatarUpdate)

        this.app.get('/product/:id', this.handleGetProduct)

        this.app.get('/products', this.handleGetProducts)

        this.app.get('/', this.onRootRequested)

        this.app.listen(this.port, this.ipAddress, () =>
        {
            console.log(`Application listening on [${this.ipAddress}]:${this.port}`)
        })
    }

    static handleUserRequest(request: Request, response: Response)
    {
        const account = request.params.account
        pool.getConnection((_, conn) =>
        {
            conn.query<RowDataPacket[]>(`SELECT * FROM users WHERE account='${account}'`, (error, results) =>
            {
                if (error) {
                    console.warn("DB ERR [handleUserRequest]");
                    return response.status(500).send(new BadResponse(ResponseType.DBConnectionFailed, error.code, error.message));
                }
                if (results.length === 0) {
                    console.log("User not found in DB. returning a empty Obj.");
                    return response.status(200).send({})
                }

                const user = results[0]
                if (!user.avatar) {
                    return response.status(200).json(user)
                }
                
                const base64String = (Buffer.from(user.avatar).toString())
                user.avatar=base64String

                response.status(200).json(user)
            })

            conn.release()
        })
    }

    static handleUserFetching(request: Request, response: Response)
    {
        const uid = request.params.uid
        pool.getConnection((_, conn) =>
        {
            conn.query<RowDataPacket[]>(`SELECT * FROM users WHERE uid='${uid}'`, (error, results) =>
            {
                if (error) {
                    console.warn("DB ERR [handleUserRequest]");
                    return response.status(500).send(new BadResponse(ResponseType.DBConnectionFailed, error.code, error.message));
                }
                if (results.length === 0) {
                    console.log("User not found in DB. returning a empty Obj.");
                    return response.status(200).send({})
                }

                const user = results[0]
                if (!user.avatar) {
                    return response.status(200).json(user)
                }
                
                const base64String = (Buffer.from(user.avatar).toString())
                user.avatar=base64String
                response.status(200).json(user)
            })

            conn.release()
        })
    }

    private static handleUserRegister(req: Request, res: Response)
    {
        const user: IUser = req.body;
        console.log(user);

        // TODO: Mysql 注册账户 
        pool.getConnection((_, conn) =>
        {
            const sql = "INSERT IGNORE INTO users (account, nickname, password) VALUES (?, ?, ?)"
            conn.query(sql, [user.account, user.nickname, user.password], (err, results, fields) =>
            {
                if (err) {
                    console.warn("DB ERR [handleUserRegister]");
                    return res.status(500).send("INVALID DATA EXCEPTION")
                }
                res.status(200).send("200")
            })

            conn.release()
        })
    }

    private static handleAvatarUpdate(request: Request, response: Response)
    {
        const account = request.params.account
        const image = request.file

        const base64String = image?.buffer.toString('base64')
        // 更新数据库中的数据
        const query = 'UPDATE users SET avatar = ? WHERE account = ?';
        pool.getConnection((_, conn) =>
        {
            conn.query(query, [base64String, account], (error, results, fields) => {
                if (error) {
                    console.error('Error updating data: ', error);
                    response.status(500).send('Error updating data');
                    return;
                }
                response.send('Data updated successfully');
            });

            conn.release()
        })
    }

    static handleGetProduct(request: Request, response: Response)
    {
        const id: string = request.params.id

        pool.getConnection((_, conn) =>
        {
            conn.query<RowDataPacket[]>(`SELECT * FROM products WHERE id='${id}'`, (error, results) =>
            {
                if (!error)
                {
                    return response.status(200).send(results[0])
                }
                else
                {
                    return response.status(500).send(error)
                }
            })

            conn.release()
        })
    }

    static handleGetProducts(_request: Request, response: Response)
    {
        pool.getConnection((_, conn) =>
        {
            conn.query<RowDataPacket[]>(`SELECT * FROM products;`, (error, results) =>
            {
                if (!error)
                {
                    return response.status(200).send(new ProductsResponse(ResponseType.Succeed, 200, results.length, results as IProduct[]))
                }
                else
                {
                    return response.status(500).send(error)
                }
            })

            conn.release()
        })
    }

    private static onRootRequested(_request: Request, response: Response)
    {
        response.status(200).send("Visit <a href='https://doc.carp.org' target='_blank'>here</a> to learn more.")
    }


    // private static validateUser(user: IUser)
    // {
    //     const requiredKeys = ['account', 'nickname', 'password'];
    //     return requiredKeys.every(key => user.hasOwnProperty(key));
    // }
}