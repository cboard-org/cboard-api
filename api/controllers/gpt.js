
module.exports = {
    editPhrase
};

async function editPhrase(req, res){
    const phraseToEdit = req.body.phrase;
    if(!phraseToEdit) {
        res.body = res.status(400).json();
        return 
    }

    //request to GPT
    const response = {phrase:'phrase'};

    res.body = res.status(200).json(response);
}