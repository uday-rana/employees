const path = require(`path`);
require(`dotenv`).config({path: path.join(__dirname, `/.env`)});
if(!process.env.DB_NAME || !process.env.DB_PASS || !process.env.DB_HOST) {
	throw Error(`Environment variables missing!`);
}
const express = require(`express`);
const exphbs = require(`express-handlebars`);
const Sequelize = require(`sequelize`);

const HTTP_PORT = process.env.PORT || 8080;
function onHTTPStart() {
	console.log(`Express HTTP server listening on: ${HTTP_PORT}`);
}

const app = express();
app.engine(`.hbs`, exphbs.engine({ extname: `.hbs` }));
app.set(`view engine`, `.hbs`);
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, `/public`)));

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_NAME, process.env.DB_PASS, {
	host: process.env.DB_HOST,
	dialect: `postgres`,
	port: 5432,
	dialectOptions: {
		ssl: { rejectUnauthorized: false },
	},
	query: { raw: true },
});

let Person = sequelize.define(`Person`, {
	firstName: Sequelize.STRING,
	lastName: Sequelize.STRING,
	age: Sequelize.INTEGER,
});

const errIDLessThanOne = `ID must be greater than zero.`;
const errIDNotFound = `A person with this ID does not exist.`;

app.get(`/`, (req, res) => {
	let sort = req.query.sort || [`id`, `DESC`];
	Person.findAll({ order: [sort] })
		.then((data) => {
			res.render(`persons`, {
				data: data,
				showReturnToTop: data.length > 10,
				title: `Persons`,
			});
		})
		.catch((err) => {
			console.log(`EXCEPTION: Attempted invalid ORDER BY: ${err}`);
			res.status(400).render(`error`, {
				errorMessage: `Sort parameter must be one of the following: id, firstName, lastName, age. Please try again.`,
			});
		});
});

app.post(`/addPerson`, (req, res) => {
	if (/([A-z]|'|-)+/.test(req.body.firstName) && /([A-z]|'|-)+/.test(req.body.lastName) && req.body.age > 0) {
		Person.create({
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			age: req.body.age,
		}).then((newPerson) => {
			console.log(`Successfully added person #${newPerson.id}`);
			res.redirect(`/`);
		});
	} else {
		console.log(`EXCEPTION: Received invalid values for adding person`);
		res.status(403).render(`error`, {
			errorMessage: `Received invalid values for adding person. Please try again.`,
		});
	}
});

app.post(`/updatePerson`, (req, res) => {
	return new Promise((resolve, reject) => {
		if (req.body.id > 0) {
			let person = null;
			Person.findByPk(req.body.id).then((found) => {
				person = found;
				if (person !== null) {
					if (/([A-z]|'|-)+/.test(req.body.firstName)) {
						Person.update({ firstName: req.body.firstName }, { where: { id: req.body.id } }).then(resolve);
					}
					if (/([A-z]|'|-)+/.test(req.body.lastName)) {
						Person.update({ lastName: req.body.lastName }, { where: { id: req.body.id } }).then(resolve);
					}
					if (req.body.age > 0) {
						Person.update({ age: req.body.age }, { where: { id: req.body.id } }).then(resolve);
					}
				} else {
					reject(errIDNotFound);
				}
			});
		} else {
			reject(errIDLessThanOne);
		}
	})
		.then(() => {
			console.log(`Successfully updated person #${req.body.id}`);
			res.redirect(`/`);
		})
		.catch((err) => {
			console.log(`EXCEPTION: ${err}`);
			res.status(403).render(`error`, {
				errorMessage: err,
			});
		});
});

app.post(`/deletePerson`, (req, res) => {
	return new Promise((resolve, reject) => {
		if (req.body.id > 0) {
			let person = null;
			Person.findByPk(req.body.id).then((found) => {
				person = found;
				if (person !== null) {
					Person.destroy({ where: { id: req.body.id } }).then(resolve);
				} else {
					reject(errIDNotFound);
				}
			});
		} else {
			reject(errIDLessThanOne);
		}
	})
		.then(() => {
			console.log(`Succesfully deleted person ${req.body.id}`);
			res.redirect(`/`);
		})
		.catch((err) => {
			console.log(`EXCEPTION: ${err}`);
			res.status(403).render(`error`, {
				errorMessage: err,
			});
		});
});

app.use((req, res) => {
	res.status(404).render(`error`, {
		errorMessage: `Page not found :/`,
	});
});

sequelize.sync().then(() => {
	app.listen(HTTP_PORT, onHTTPStart);
});
