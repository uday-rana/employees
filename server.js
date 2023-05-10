const path = require(`path`);
require(`dotenv`).config();
if (!process.env.DB_NAME || !process.env.DB_PASS || !process.env.DB_HOST) {
	throw Error(`Environment variables missing!`);
}
const express = require(`express`);
const exphbs = require(`express-handlebars`);
const Sequelize = require(`sequelize`);

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
	email: Sequelize.STRING,
	phone: Sequelize.STRING,
	department: Sequelize.STRING,
});

const HTTP_PORT = process.env.PORT || 8080;
const errIDLessThanOne = new Error(`ID must be greater than zero.`);
const errIDNotFound = new Error(`A person with this ID does not exist.`);

function onHTTPStart() {
	console.log(`Express HTTP server listening on: ${HTTP_PORT}`);
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

app.get(`/`, (req, res) => {
	let sort = req.query.sort || [`id`, `DESC`];
	Person.findAll({ order: [sort] })
		.then((data) => {
			res.render(`persons`, {
				data: data,
				showReturnToTop: data.length > 10,
				title: `Home | Persons`,
			});
		})
		.catch((error) => {
			console.log(`ERROR: ${error}`);
			res.status(400).render(`error`, {
				errorMessage: `Sort parameter must be an existing column. Please try again.`,
			});
		});
});

app.post(`/add`, (req, res) => {
	if (
		/^[A-z'-\s]+$/.test(req.body.firstName) &&
		/^[A-z'-\s]+$/.test(req.body.lastName) &&
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email) &&
		/^\+?\d{0,3}\s?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(req.body.phone) &&
		/^[A-z\d\s&'-]+$/.test(req.body.department)
	) {
		Person.create({
			firstName: capitalizeFirstLetter(req.body.firstName),
			lastName: capitalizeFirstLetter(req.body.lastName),
			email: req.body.email,
			phone: req.body.phone,
			department: req.body.department,
		}).then((newPerson) => {
			console.log(`Successfully added person #${newPerson.id}: ${newPerson.firstName} ${newPerson.lastName}`);
			res.redirect(`/`);
		});
	} else {
		console.log(`ERROR: Received invalid values for adding person`);
		res.status(403).render(`error`, {
			errorMessage: `Received invalid values for adding person. Please try again.`,
		});
	}
});

app.get(`/update`, async (req, res) => {
	try {
		// Must use a query because express replaces id parameter
		// with the string 'style.css' for some reason
		if (req.query.id < 1) {
			throw errIDLessThanOne;
		}
		let person = await Person.findByPk(req.query.id);
		if (!person) {
			throw errIDNotFound;
		}
		res.render(`update`, {
			data: person,
			title: `Update | Persons`,
		});	
	} catch (error) {
		console.log(`ERROR: ${error}`);
		res.status(400).render(`error`, { errorMessage: error });
	}
});

app.post(`/update`, async (req, res) => {
	try {
		if (req.body.id < 1) {
			throw errIDLessThanOne;
		}
		let person = await Person.findByPk(req.body.id);
		if (!person) {
			throw errIDNotFound;
		}
		if (/^[A-z'-\s]+$/.test(req.body.firstName)) {
			await Person.update({ firstName: capitalizeFirstLetter(req.body.firstName) }, { where: { id: req.body.id } });
		}
		if (/^[A-z'-\s]+$/.test(req.body.lastName)) {
			await Person.update({ lastName: capitalizeFirstLetter(req.body.lastName) }, { where: { id: req.body.id } });
		}
		if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
			await Person.update({ email: req.body.email }, { where: { id: req.body.id } });
		}
		if (/^\+?\d{1,3}?\s?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(req.body.phone)) {
			await Person.update({ phone: req.body.phone }, { where: { id: req.body.id } });
		}
		if (/^[A-z\d\s&'-]+$/.test(req.body.department)) {
			await Person.update({ department: req.body.department }, { where: { id: req.body.id } });
		}

		console.log(`Successfully updated person #${req.body.id}`);
		res.redirect(`/`);
	} catch (error) {
		console.log(`ERROR: ${error}`);
		res.status(400).render(`error`, { errorMessage: error });
	}
});

app.get(`/delete`, async (req, res) => {
	try {
		// Must use a query because express replaces id parameter
		// with the string 'style.css' for some reason
		if (req.query.id < 1) {
			throw errIDLessThanOne;
		}
		let person = await Person.findByPk(req.query.id);
		if (!person) {
			throw errIDNotFound;
		}
		await Person.destroy({ where: { id: req.query.id } });

		console.log(`Successfully deleted person ${req.query.id}`);
		res.redirect(`/`);
	} catch (error) {
		console.log(`ERROR: ${error}`);
		res.status(400).render(`error`, {
			errorMessage: err,
		});
	}
});

app.use((req, res) => {
	res.status(404).render(`error`, {
		errorMessage: `Page not found :/`,
	});
});

sequelize.sync().then(() => {
	app.listen(HTTP_PORT, onHTTPStart);
});
